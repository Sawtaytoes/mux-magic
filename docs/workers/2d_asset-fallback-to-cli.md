# Worker 2d — asset-fallback-to-cli

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/2d-asset-fallback-to-cli`
**Worktree:** `.claude/worktrees/2d_asset-fallback-to-cli/`
**Phase:** 4 (server infrastructure)
**Depends on:** 01 (rebrand), 20 (CLI exists as a target to fall back to)
**Parallel with:** 41, 29, 2a, 2c, 38, 3b, 3c, 3e, 40. Independent of Phase 3.

> **Why this worker exists:** a handful of read-only operations are currently HTTP routes on the server (file listings, media-info probes, etc.) that the user can also invoke via the CLI. When the server isn't running, the CLI fails silently or with a confusing "ECONNREFUSED" because it's actually trying to talk to a server URL. This worker makes the CLI smart enough to detect "no server reachable" and **fall back to invoking the same operation locally** — i.e., it does the work itself instead of asking a non-existent server. The server stays the canonical place for these endpoints; the CLI just stops requiring it.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Identify CLI commands that today either (a) call the local server or (b) only work when run as part of a server-backed sequence, and add a "no-server" fallback path that invokes the underlying business logic directly from `@mux-magic/tools`.

### Candidate commands (audit first)

The CLI structure produced by worker 20 lives at [packages/cli/](../../packages/cli/). Audit its commands and pick the ones that:
1. Are pure-read / pure-probe (no side effects beyond reading the filesystem or spawning a one-shot subprocess).
2. Have a business-logic implementation already available in `@mux-magic/tools` or a helper that can move there cheaply.
3. Currently fail or warn loudly when the server is down.

Probable candidates:
- `mux-magic ls` / `mux-magic find` (file listings)
- `mux-magic media-info <path>` (probe a single file's mediainfo)
- `mux-magic detect-format` (variant detection)
- Anything else where the CLI is essentially a remote-debug helper

Explicitly **out of scope**:
- Commands that mutate state (`copyFiles`, `moveFiles`, anything that writes to disk) — those should keep going through the job system so logs, webhooks, and the error store catch them.
- Commands that depend on running ffmpeg/mkvmerge child processes for non-trivial durations — keep those on the server so cancellation works.

### Fallback decision

The CLI command function takes the form:

```ts
const run = async (args: ParsedArgs) => {
  const serverReachable = await tryServer(args.serverUrl)

  return serverReachable
    ? runViaServer(args)   // existing path
    : runLocally(args)     // new fallback path
}
```

`tryServer` is a 250ms-timeout `HEAD /api/health` (the same endpoint worker 29 may also rely on — coordinate). On any timeout, connection refused, DNS failure, or non-2xx, treat the server as unreachable and fall back.

When falling back, print a single one-line stderr notice the first time per process: `mux-magic: server unreachable at <url>; running locally`. Suppress subsequent notices (a `WeakSet<args>` keyed on the runtime, or a module-level boolean — whichever is simpler).

### Local execution

For each candidate command, the local-execution path imports the same pure logic the server route imports. After worker 2c lands, that logic is likely under `@mux-magic/tools` already; worker 2d wires the CLI to import it.

Output format: match the server response shape exactly (JSON to stdout when `--json` is set; otherwise a human-friendly format). Don't introduce a new output dialect for the local path.

### Behavior under `--server <url>` explicit flag

If the user passed `--server` explicitly, **don't fall back** — fail loudly. The explicit flag signals "talk to this server or fail". Only the default-server case ("no flag passed, the CLI tried to talk to localhost") falls back.

### Out of scope

- Mutating commands (write side, job submission) — those always require the server.
- Long-running subprocess work (transcoding, GPU re-encode) — server-only.
- Falling back when the server returns 5xx — only fall back on transport-level failure (refused / timeout / DNS). A 500 from a reachable server means the server has the work in flight or has logged an error; the CLI should surface that.

## Tests (per test-coverage discipline)

- **Unit:** `tryServer` returns `false` on timeout / refused / DNS / non-2xx; returns `true` only on 2xx.
- **Unit:** the per-process "server unreachable" notice fires once and only once.
- **Unit:** with `--server <url>` explicit, refusal propagates as an error rather than triggering fallback.
- **Integration:** running `mux-magic ls <dir>` with no server reachable produces the same output as running it with a healthy server.
- **Integration:** running `mux-magic media-info <file>` with no server reachable matches the server-backed output.

## TDD steps

1. Failing tests for `tryServer` + the one-shot notice. Commit `test(cli-fallback): failing tests for server probe`.
2. Implement the probe + notice helper in a shared CLI module.
3. Pick the first candidate command (probably `ls`). Failing integration test asserting no-server-equals-server output. Commit.
4. Wire fallback into that command. Green.
5. Repeat for each additional candidate. Each is a small commit.
6. Manifest row → `done` (separate commit).

## Files

- [packages/cli/src/serverProbe.ts](../../packages/cli/src/serverProbe.ts) — new; the 250ms probe + one-shot notice
- [packages/cli/src/commands/](../../packages/cli/src/commands/) — one edit per command that gets the fallback path
- Tests for each
- Possibly: [packages/server/src/api/routes/](../../packages/server/src/api/routes/) — add `/api/health` if worker 29 hasn't already

## Verification checklist

- [ ] Workers 01 + 20 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] `tryServer` covers refused / timeout / DNS / non-2xx without false negatives
- [ ] The "server unreachable" notice fires exactly once per process
- [ ] `--server <url>` explicit flag disables fallback (errors instead)
- [ ] Read-only candidate commands work with the server off
- [ ] Mutating commands still require the server (no accidental local-execution path added)
- [ ] Local output matches server output byte-for-byte for `--json`; human format may differ slightly but covers the same fields
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` in a separate commit
