# Worker 4a — duplicate-music-files-scheduler-audit

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/4a-duplicate-music-files-scheduler-audit`
**Worktree:** `.claude/worktrees/4a_duplicate-music-files-scheduler-audit/`
**Phase:** 5
**Depends on:** 11 (per-job thread budget), 38 (per-file pipelining)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) or its CLI binding.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Audit the existing [hasDuplicateMusicFiles](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) command against two infrastructure changes that landed after it was written:

1. **Worker 11's per-job thread budget** — every command running through the sequence runner now claims threads from a per-job pool (governed by the user-set `threadCount` Variable, capped at the `DEFAULT_THREAD_COUNT` env ceiling). Commands that don't cooperate either starve (claiming more than budget allows) or stall the budget (holding threads while idle).
2. **Worker 38's per-file pipelining** — `sequenceRunner.ts` no longer waits for a step to complete on every file before starting the next step. Files flow through steps continuously, and any step that assumes "all files have already arrived" before producing output deadlocks downstream steps.

Today the command does:

```
getFilesAtDepth(…)
  |> filterIsAudioFile
  |> map(toPath)
  |> groupBy(normalizedNameKey)            // groups by basename-minus-suffix
  |> mergeMap(group => group.pipe(skip(1), take(2), map(()=>group.key)))
  |> map(dirname)
  |> groupBy(dir => dir)
  |> mergeMap(group => group.pipe(take(1)))
  |> tap(console.info)
```

The first `groupBy` is the load-bearing operator: each new path either opens a new group or joins one. The `skip(1).take(2)` inside the inner `mergeMap` only emits when a group sees its 2nd or 3rd member. This **does not** require a terminal `toArray()` — it emits incrementally as duplicates are discovered, which is friendly to per-file pipelining. But two failure modes still need verification.

### What to verify

1. **`groupBy` keeps group subscriptions open indefinitely** until the source completes. Under per-file pipelining (worker 38), the upstream source still terminates when the directory walk completes, so this is fine in principle. Confirm by running the command against a fixture directory through the pipelined sequence runner and asserting: (a) the duplicate report is identical to running it standalone; (b) the runner reports the command complete (no dangling open groups holding the job in `running`).
2. **Concurrency claim posture.** `getFilesAtDepth` does the directory walk synchronously-ish (it's a filesystem walk, not a CPU pool consumer); the `mergeMap` operators here are pure transforms with no spawned subprocesses. The command should claim **at most one thread** from the per-job budget — this is an I/O-bound walk + in-memory grouping, not an `mkv*`/`ffmpeg` spawn worker. Verify against worker 11's taskScheduler API (`packages/tools/src/taskScheduler*.ts` and how callers wire `perJobClaim`). If the command currently claims more than 1, narrow it. If it doesn't claim at all (and the scheduler permits non-claiming runs as "lightweight"), document that decision in the PR.
3. **No-`toArray`, no batch-mode coupling.** Confirm the pipeline doesn't currently terminate in `.pipe(toArray())` (it doesn't, per the snippet above) and that nothing downstream of the command implicitly expects batched output. Grep callers in `packages/server/src/api/`, `packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts`, and any sequence-runner expansion to confirm. The CLI subscriber [hasDuplicateMusicFilesCommand.ts](../../packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts) just `subscribeCli()` — fine.

### Decisions to make in the PR

- **Keep streaming dedup as-is** (preferred outcome if §1 above passes) — the existing operator chain is already pipeline-friendly. Add an integration test that *locks in* the streaming behavior so a future refactor can't silently regress it into a `toArray()` form.
- **OR rewrite to explicit streaming dedup** — if you find a subtle bug under the pipelined runner (e.g. the second `groupBy` over `dirname` holds groups open in a way that leaks per-job memory on huge libraries), rewrite the second stage as a `scan`-based seen-set that emits each directory exactly once. Stay incremental — do not introduce a terminal `toArray()` in either direction.

Whichever path you choose, document the decision and the evidence supporting it in the PR description.

### Per-job claim wiring (load-bearing)

Find how worker 11 / worker 38 expect app-commands to claim threads. Existing tag-touching and remux commands wired through `runMkvPropEdit`/`runMkvMerge`/`runFfmpeg` claim via the spawn op. `hasDuplicateMusicFiles` spawns nothing, so it needs an explicit lightweight claim (or a documented "lightweight, no claim needed" annotation per worker 11's contract). Pick the same posture other lightweight commands use — grep `packages/server/src/app-commands/**` for the convention; if no precedent exists, claim 1 thread per command invocation (not per file).

## Tests (per test-coverage discipline)

- Unit: fixture directory with known duplicates (across both case-variants: `(2)` suffix, ` - Copy` suffix, mixed-extension `.flac` + `.mp3` same-name pair) — the command emits the expected directory names exactly once each, regardless of file traversal order.
- Unit: empty directory and no-duplicate directory both complete cleanly with zero emissions.
- Integration: run the command through the pipelined sequence runner (worker 38 surface) against a 3-step sequence where `hasDuplicateMusicFiles` is the middle step. Verify completion, log content, and no dangling job state.
- Concurrency: with the per-job thread budget set to 1, the command still completes; with budget set to 4 and the command running alongside a heavier sibling step (e.g. a faked `mkvpropedit` op), neither step starves.
- Regression: a guard test that asserts the operator chain does **not** end in `toArray()` (literally a source-text or AST check) so future drift is loud.

## TDD steps

1. **Red** — `test(srv): failing tests for hasDuplicateMusicFiles under pipelined runner`. The unit cases pass against today's code; the integration case is the failing one if a bug exists, otherwise it locks in the streaming contract.
2. **Investigate + green** — implement the chosen path (keep-as-is + lock-in tests OR rewrite to explicit streaming dedup) and the per-job claim wiring. Separate commit for the streaming-shape regression guard test.
3. **Manifest** — `chore(manifest): worker 4a done`.

## Files

### Extend

- [packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) — at minimum, add per-job claim wiring; rewrite operators only if §1 found a bug
- [packages/server/src/app-commands/hasDuplicateMusicFiles.test.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.test.ts) — new tests (create if missing)

### Reference (read, do not change unless audit forces it)

- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — pipelined-mode entry per worker 38
- [packages/tools/src/taskScheduler.ts](../../packages/tools/src/taskScheduler.ts) and `taskScheduler.injection.test.ts` — per-job claim contract from worker 11
- [packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts](../../packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts) — CLI subscriber; should not need changes

### Reuse — do not reinvent

- `filterIsAudioFile` and `getFilesAtDepth` stay as the file-source primitives.
- The taskScheduler `perJobClaim` API governs concurrency. Do not invent a parallel limiter.

## Verification checklist

- [ ] Audit findings (per-job claim posture, streaming behavior under pipelined runner, decision: keep-as-is vs. rewrite) documented in PR description
- [ ] Failing-test commit landed before the green commit
- [ ] Streaming-shape regression guard test in place (asserts no `toArray()` terminal in the operator chain)
- [ ] Manual smoke against a real music library directory containing duplicates — output matches what the pre-audit command emitted on the same directory
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] `chore(manifest): worker 4a done` is a separate commit
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`

## Out of scope

- Adding new duplicate-detection heuristics (audio fingerprinting, perceptual matching). Worker `4b` (audio-library-fingerprint-dedup) owns that surface — keep the boundary clean.
- Changing the user-visible output shape of `hasDuplicateMusicFiles`. This is an internal audit; the report format the user already relies on must stay byte-identical.
- Generalizing per-job-claim wiring into a shared mixin/helper. If a pattern emerges across multiple lightweight commands, extract in a follow-up worker, not here.
- Touching `runMkvPropEdit` / `runMkvMerge` / `runFfmpeg` claim posture. Those go through their own spawn-op claims and are unaffected.
