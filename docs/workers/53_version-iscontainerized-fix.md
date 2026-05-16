# Worker 53 — version-iscontainerized-fix

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/53-version-iscontainerized-fix`
**Worktree:** `.claude/worktrees/53_version-iscontainerized-fix/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that doesn't touch [packages/server/src/api/routes/versionRoutes.ts](../../packages/server/src/api/routes/versionRoutes.ts) or the root [Dockerfile](../../Dockerfile).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

`GET /version` currently reports `isContainerized: true` on local non-containerised runs because the detection probe is `existsSync("/.dockerenv")` ([packages/server/src/api/routes/versionRoutes.ts:74](../../packages/server/src/api/routes/versionRoutes.ts)). That sentinel file exists for a host of reasons that don't mean "I'm in a container" — most commonly a leftover from a previous Docker install, a host-side `touch` for a tool that expected it, or a bind-mount probe from another stack. The result: the UI hides host-only affordances (like "Open in player") on a developer's normal local server.

> Heads up — this worker was originally filed as id `47`, then renumbered to `53` because `47` was already in use by [`47_errors-panel-and-e2e`](47_errors-panel-and-e2e.md). Per the plan's "never renumber filed workers" rule, the older slot kept its number and this one moved.

Replace the negative-only probe with a **positive container signal**:

1. **Build-time env var (primary).** Set `MUX_MAGIC_CONTAINER=1` in the [Dockerfile](../../Dockerfile) (`ENV MUX_MAGIC_CONTAINER=1` alongside the existing `ENV NODE_ENV=production`). The route trusts this var: if `process.env.MUX_MAGIC_CONTAINER === "1"`, the answer is `true` and we don't probe the filesystem at all.
2. **`/proc/1/cgroup` substring check (fallback for Linux containers built outside this Dockerfile).** Read the file with `readFileSync` inside a try/catch; treat absence as "not a container". Match any of the substrings `docker`, `containerd`, `kubepods` in the contents. This catches containers built from other base images that didn't get our `MUX_MAGIC_CONTAINER` env baked in.
3. **Everything else returns `false`.** Drop the `existsSync("/.dockerenv")` check entirely — it's the source of the bug.

### Resolution rules

- The probe still runs **once at module load** and caches the result. The Docker bind-mount (or its absence) doesn't change at runtime; we don't want every `/version` hit to read `/proc/1/cgroup`.
- On Windows / macOS hosts, both signals are absent — `/proc/1/cgroup` is a Linux-only file. The fallback's try/catch handles that cleanly; the result is `false`.
- The existing `versionFileSchema.describe(...)` text should be updated to mention the new detection mechanism so the OpenAPI surface stays self-documenting.

## Tests (per test-coverage discipline)

- Unit test for an extracted `detectIsContainerized` helper:
  - Env var set to `"1"` → `true` (regardless of filesystem).
  - Env var unset, `/proc/1/cgroup` reads as `"… docker …"` → `true` (mock the reader).
  - Env var unset, `/proc/1/cgroup` reads as `"0::/init.scope"` (host systemd) → `false`.
  - Env var unset, `/proc/1/cgroup` read throws (e.g., ENOENT on Windows) → `false`.
  - Leftover `/.dockerenv` on the host is **not** consulted — assert the helper doesn't read that path.

Extract the detection into a small pure helper (taking the env-getter + cgroup-reader as injectable functions) so the test doesn't have to stub `node:fs` globally.

## TDD steps

1. **Red.** Add `versionRoutes.detectIsContainerized.test.ts` next to `versionRoutes.ts` covering the cases above. Commit `test(server): failing tests for positive container detection`.
2. **Green.** Extract `detectIsContainerized` (pure, injectable) + replace the `existsSync("/.dockerenv")` line with a call to it. Commit.
3. **Dockerfile.** Add `ENV MUX_MAGIC_CONTAINER=1` alongside the existing env vars. Commit `feat(docker): stamp positive container signal for /version`.
4. **Manifest.** Dedicated `chore(manifest):` flip commits.

## Files

- [packages/server/src/api/routes/versionRoutes.ts](../../packages/server/src/api/routes/versionRoutes.ts) — extract `detectIsContainerized`; drop `existsSync("/.dockerenv")`; update the schema `.describe(...)`.
- `packages/server/src/api/routes/versionRoutes.detectIsContainerized.test.ts` — new.
- [Dockerfile](../../Dockerfile) — add `ENV MUX_MAGIC_CONTAINER=1`.

## Out of scope

- Changing the `isContainerized` field's name or shape.
- Reshaping how the UI consumes the flag — `FileVideoPlayer` / `FileExplorerModal` already gate on it; that wiring stays.
- Adding other container runtimes' positive signals (Podman, etc.) — the `/proc/1/cgroup` fallback's substring set is the bounded list for now.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] `grep` for `\.dockerenv` returns no hits in `packages/server/**`
- [ ] All new tests pass
- [ ] Local `yarn dev:api-server` followed by `curl http://localhost:$PORT/version` reports `isContainerized: false` on the dev host
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
