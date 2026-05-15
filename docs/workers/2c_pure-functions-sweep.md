# Worker 2c — pure-functions-sweep

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/2c-pure-functions-sweep`
**Worktree:** `.claude/worktrees/2c_pure-functions-sweep/`
**Phase:** 4 (server infrastructure)
**Depends on:** 20 (CLI extract — finalizes the split between business logic and process I/O)
**Parallel with:** 41, 2a, 3b, 3c, 3e, 40. **NOT parallel with 38 (per-file-pipelining)** — that worker rewrites the same command handlers this one touches; coordinate. **NOT parallel with Phase 3 NSF workers** if this worker reaches into the NSF code paths — keep this sweep out of `nameSpecialFeatures*` files entirely (Phase 3 owns that surface). When this lands first: Phase 3 rebases trivially. When Phase 3 lands first: this worker excludes those files.

> **Why this worker exists:** the server's helper layer mixes side effects (filesystem reads, child-process spawns, env-var reads, `Date.now()` calls, RNG) into otherwise pure-looking transforms. This makes testing painful — every test ends up mocking three or four modules to exercise one branch. The fix is mechanical but high-judgement: thread the side-effectful inputs in as parameters or injected deps, leave the side-effect call sites at the edges, and turn the middle into actual pure functions.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Sweep the server-side helper layer and split each file into:

1. A **pure function** that takes inputs and returns outputs with no I/O.
2. A **thin wrapper** that does the I/O at the edges and calls the pure function in the middle.

Tests then move toward the pure half — fewer mocks, faster runs, more behaviour covered per test.

### Scope

In: [packages/server/src/tools/](../../packages/server/src/tools/) — utilities that are not command handlers. Examples of likely targets (audit before committing):
- `canonicalizeMovieTitle.ts` — already pure-looking; verify
- `applyAssRules.ts` — has `Date.now()`-shaped behavior in some paths
- `getOutputPath.ts` — does path construction; check for env-var reads
- `detectMovieFormatVariants.ts` — pure-with-side-effects mix
- `audioHelpers.ts`, `hdrHelpers.ts`, `subtitleHelpers.ts` — likely candidates
- Anything else where the function does both "read a file" and "transform what was read".

Out:
- **Command handlers under [packages/server/src/app-commands/](../../packages/server/src/app-commands/)** — those return Observables and worker 38 is rewriting them. Leave them alone; worker 38 reshapes the side-effect boundary as part of its rewrite.
- **`nameSpecialFeatures*` files** — Phase 3 owns them.
- **`schema.generated/`**, `loadEnv.ts`, `server.ts`, top-level bootstrap files.
- **rxjs operator pipelines** — those are wired in worker 21; touching them invites merge pain.

### What "pure" means here

A function is pure in this sweep when:
- Same inputs produce same outputs (no `Date.now()`, `Math.random()`, `process.env.*` reads).
- No side effects (no `console.*`, no `fs.*`, no `spawn`).
- All async I/O has been hoisted to a wrapper that calls it.

Where a function legitimately needs the time/RNG/env, take them as parameters:

```ts
// Before
export const buildOutputPath = (input: string): string => {
  const stamp = Date.now()
  const base = process.env.OUTPUT_DIR ?? "./out"
  return `${base}/${input}-${stamp}.mkv`
}

// After: pure core
export const buildOutputPath = (
  input: string,
  deps: { now: number; outputDir: string },
): string => `${deps.outputDir}/${input}-${deps.now}.mkv`

// Thin wrapper at the call site
buildOutputPath(input, { now: Date.now(), outputDir: process.env.OUTPUT_DIR ?? "./out" })
```

### What NOT to do

- Do not over-engineer with a DI container, IoC framework, or "service locator". Pass deps as plain parameter objects.
- Do not change function names unless the rename clearly improves readability — `getX` stays `getX` in the pure version too. Don't churn the call site grep.
- Do not collapse `getOutputPath` and `getDemoName` into one "helper" file — keep the file-per-function structure the codebase prefers.
- Do not change Observable signatures (the wrapper can still return an `Observable<T>`; the pure core just doesn't).
- Do not migrate every file in one PR if the diff balloons. **Target ~10–20 files per PR.** If the sweep is larger, split into multiple PRs against `feat/mux-magic-revamp` and update the manifest with sub-status notes.
- Do not change behavior. If you find a bug while sweeping, file a separate issue or open a separate PR. This sweep is refactor-only.

### Definition of "done" per file

1. Identify side effects.
2. Extract the pure core; the wrapper retains the original exported name and signature **when possible** so call sites don't need to change.
3. Add or improve unit tests for the pure core (most files in scope already have tests — extend them).
4. Verify the wrapper's behavior with an integration test that hits the real filesystem (or whatever I/O the wrapper does), but keep the count small — most coverage shifts to the pure tests.
5. The wrapper file is allowed to be 5–20 lines and look "trivial". That's the point.

### Coordination with worker 38

Worker 38 rewrites command handlers, not the helpers in scope here. But some helpers are called from inside command-handler Observables (e.g., `getOutputPath` called inside `copyFiles`'s `mergeMap`). Keep the helper's external signature unchanged so worker 38's rewrite doesn't need to know about this sweep.

If worker 38 lands first: this worker rebases trivially (the helpers stay where they are; only the handler internals moved).
If this lands first: worker 38 benefits — it can compose against now-pure helpers more cleanly.

## Tests (per test-coverage discipline)

- **Unit:** per swept file — the pure core's input/output table covers all branches without any mock setup.
- **Integration:** the thin wrapper still hits real I/O for at least the happy path.
- **Regression:** all existing tests still pass with no signature changes at the call sites.
- **Snapshot-free:** project convention prohibits snapshot tests — inline expected values per the existing pattern.

## TDD steps

1. Pick a target list (start with `canonicalizeMovieTitle`, `getOutputPath`, `audioHelpers`, then expand).
2. For each file, write the failing pure-core test first if coverage is lacking. Commit `test(pure-sweep): failing tests for <module>`.
3. Extract the pure core; wrapper retains the original exported name. Commit `refactor(pure-sweep): extract pure core of <module>`.
4. Repeat until the PR diff feels reviewable (~10–20 files).
5. If more files remain, open a follow-up PR with `<id>-followup-N` suffix in the branch name; update manifest row with sub-status.
6. Manifest row → `done` only when the planned scope is complete.

## Files

- ~10–20 files under [packages/server/src/tools/](../../packages/server/src/tools/) — list explicitly in the PR description.
- Tests for each (most files already have a sibling `.test.ts`).

## Verification checklist

- [ ] Worker 20 ✅ merged before starting
- [ ] Coordinated with worker 38 (or 38 not yet started)
- [ ] No `nameSpecialFeatures*` files touched (Phase 3 territory)
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Each swept file has a pure core + thin wrapper
- [ ] Pure cores take time/RNG/env as parameters
- [ ] Call sites unchanged (wrapper preserves exported signature)
- [ ] Unit tests for pure cores are mock-free (or near-zero mocks)
- [ ] PR description lists every file touched + a one-line "what side effect moved out" for each
- [ ] No behavior changes (find a bug? file separately)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` (or sub-status if split into multiple PRs)

## Why High effort

This worker is in the "Low — model uncertain" bucket of the plan's confidence table. Not because any one file is hard, but because deciding "is this side effect really worth threading through as a parameter, or is this case an over-pure-ification?" requires judgement that fails silently. The blast radius is broad (touches many call sites) and the value is medium (testability) — be conservative on aggressive extraction.
