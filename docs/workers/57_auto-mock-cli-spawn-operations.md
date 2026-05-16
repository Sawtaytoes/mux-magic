# Worker 57 — auto-mock-cli-spawn-operations

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker-57-auto-mock-cli-spawn-operations`
**Worktree:** `.claude/worktrees/57_auto-mock-cli-spawn-operations/`
**Phase:** infra
**Depends on:** —
**Parallel with:** any worker that doesn't add new tests under [packages/server/src/app-commands/](../../packages/server/src/app-commands/) — those touch the same setup file.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Surfaced during worker 4d's code review. Every existing app-command test that touches a CLI-wrapper spawn-op uses the same boilerplate:

```ts
vi.mock("../cli-spawn-operations/runMkvExtractStdOut.js", () => ({
  runMkvExtractStdOut: vi.fn(),
}))

vi.mock("../cli-spawn-operations/writeChaptersMkvMerge.js", () => ({
  writeChaptersMkvMerge: vi.fn(),
}))

const { runMkvExtractStdOut } = await import("../cli-spawn-operations/runMkvExtractStdOut.js")
const { writeChaptersMkvMerge } = await import("../cli-spawn-operations/writeChaptersMkvMerge.js")
```

That's a copy-paste contract: **"any module under `packages/server/src/cli-spawn-operations/` must be stubbed in tests"** — for the same reason `node:fs` is already auto-mocked to `memfs` in [vitest.setup.ts](../../packages/server/vitest.setup.ts): spawn-ops wrap 3rd-party executables (`mkvextract`, `mkvmerge`, `mkvpropedit`, `ffmpeg`, `fpcalc`) that aren't installed in CI, hit real disk, and produce output we can't construct deterministically from `vol.fromJSON`.

The problem with the per-test pattern:

1. **Easy to forget.** A new test that imports a spawn-op without mocking will silently spawn a real binary (or fail with `ENOENT` if the binary isn't on PATH) — depending on the dev host.
2. **Inconsistent error mode.** Some forgotten mocks crash CI, others just hang waiting on a process that never starts.
3. **Boilerplate cost grows linearly** with each new spawn-op + each new app-command test (workers 4d/4e/4f/4b all add tests in this shape).

## Your Mission

Lift the per-test mocking into [packages/server/vitest.setup.ts](../../packages/server/vitest.setup.ts), paralleling the existing memfs auto-mock. After this lands, individual tests just call `vi.mocked(runMkvExtractStdOut).mockReturnValue(...)` without any `vi.mock(...)` calls.

### 1. Auto-mock setup

Extend `vitest.setup.ts` with a registry-driven `vi.mock` call per `cli-spawn-operations/*.ts` file. Approach:

```ts
// vitest.setup.ts
import { vi } from "vitest"

// Auto-mock every module under cli-spawn-operations/ — they all wrap
// 3rd-party CLI binaries (mkvextract / mkvmerge / mkvpropedit / ffmpeg
// / fpcalc) that aren't installed in CI and can't be safely spawned
// during tests. Same rationale as the node:fs → memfs auto-mock above:
// the test-environment boundary is the process-spawn layer.
//
// Tests opt in to per-call behavior with vi.mocked(fn).mockReturnValue(...)
// or vi.mocked(fn).mockImplementation(...). Forgetting to stub a spawn-op
// returns undefined — loud failure, not a real process spawn.
vi.mock("./src/cli-spawn-operations/runMkvMerge.js", () => ({
  runMkvMerge: vi.fn(),
}))
vi.mock("./src/cli-spawn-operations/runMkvExtractStdOut.js", () => ({
  runMkvExtractStdOut: vi.fn(),
}))
// … one entry per spawn-op file
```

If vitest supports a directory-glob form, prefer that over the explicit list — easier to maintain. Otherwise the explicit list is fine and can be regenerated from a `Glob` if it ever drifts.

**Edge case:** some spawn-ops export both a function AND a `*DefaultProps` object literal (e.g. `reorderTracksFfmpeg.ts`). The mock factory must preserve the default-props export shape so app-command imports keep working at module-eval time. Check [reorderTracks.test.ts](../../packages/server/src/app-commands/reorderTracks.test.ts) for the current shape.

### 2. Refactor existing tests

Remove the per-test `vi.mock("../cli-spawn-operations/...")` calls from every app-command test that has them. Keep the `vi.mocked(...).mockReturnValue(...)` / `.mockImplementation(...)` calls — those still drive per-test behavior. Audit:

```
packages/server/src/app-commands/nameMovieCutsDvdCompareTmdb.test.ts
packages/server/src/app-commands/remuxToMkv.test.ts
packages/server/src/app-commands/reorderTracks.test.ts
packages/server/src/app-commands/renumberChapters.test.ts   ← added by worker 4d
```

Plus any test under `packages/server/src/tools/` that mocks a spawn-op (rare; double-check).

### 3. Document the convention

Add a one-paragraph note to [docs/agents/testing.md](../../docs/agents/testing.md) under the "Unit Tests (vitest)" section, right next to the existing memfs mention:

> Modules under `packages/server/src/cli-spawn-operations/` are auto-mocked in `vitest.setup.ts` — every spawn-op wraps a 3rd-party `mkvtoolnix` / `ffmpeg` / `fpcalc` binary, so we draw the test boundary at the process-spawn layer the same way we draw it at the `node:fs` boundary with memfs. Tests opt in to per-call behavior with `vi.mocked(spawnOpFn).mockReturnValue(...)`; forgetting to stub returns `undefined` (loud failure) rather than silently shelling out.

### 4. (Optional) Loud failure on forgotten stub

A `vi.fn()` that returns `undefined` is loud-ish but not maximally helpful — the failure surfaces as `cannot read property 'pipe' of undefined`. If easy, swap the default `vi.fn()` for `vi.fn(() => { throw new Error(\`spawn-op \${name} called without a mock — see worker 57\`) })` so the failure points at the missing stub. Skip if the implementation complicates the directory-glob form.

## Tests

- No new test files — this is a refactor of existing tests.
- After the refactor, every existing app-command test must still pass without modification beyond `vi.mock(...)` removal.
- Verify the failure mode of the optional "loud failure" change with one targeted test that imports a spawn-op without stubbing.

## TDD steps

1. **Setup file change first.** Add the auto-mocks. Run `yarn test` — the existing per-test `vi.mock` calls become redundant but shouldn't conflict (vitest dedupes).
2. **Refactor each app-command test.** Remove the per-test `vi.mock(...)` calls one file at a time, re-running `yarn vitest run <file>` after each.
3. **Sweep grep for any remaining `vi.mock(".*cli-spawn-operations.*"`)`** — they should all be gone.
4. **Add the docs/agents/testing.md note.**

## Files

### Extend

- [packages/server/vitest.setup.ts](../../packages/server/vitest.setup.ts) — add the auto-mock block.
- [docs/agents/testing.md](../../docs/agents/testing.md) — document the convention.
- ~4 existing app-command test files — strip per-test `vi.mock(...)` calls.

### Reuse — do not reinvent

- The existing memfs auto-mock in `vitest.setup.ts` — mirror its placement and style.

## Out of scope

- Dependency injection refactor of the app-commands themselves. Considered and rejected: inconsistent with the codebase, bloats every production call site with test-only seams, doesn't actually remove the test-environment problem (DI'd tests still need fake observables).
- Mocking spawn-ops in CLI integration tests (`packages/cli/src/cli.integration.test.ts`) — those exercise the CLI's argv routing and should keep their own mocking strategy.
- Auto-mocking other 3rd-party boundaries (network: `fetch`, `node-fetch`; ipc: `child_process` directly). Out of scope; spawn-ops are the boundary that's already conventional in this repo.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress`
- [ ] `vitest.setup.ts` auto-mocks every spawn-op
- [ ] Zero remaining `vi.mock(".*cli-spawn-operations.*"`)` calls in the test corpus
- [ ] docs/agents/testing.md updated
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
