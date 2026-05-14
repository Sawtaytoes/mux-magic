# Worker 38 — per-file-pipelining

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/38-per-file-pipelining`
**Worktree:** `.claude/worktrees/38_per-file-pipelining/`
**Phase:** 4 (server infrastructure)
**Depends on:** 20 (CLI extract), 21 (observables-shared-split), 28 (structured-logging-otel — needed to debug streaming behavior)
**Parallel with:** Other Phase 4 workers that don't touch sequenceRunner or command handlers (29 openapi-codegen-optional, 2a server-template-storage). NOT parallel with 2c (pure-functions-sweep) — that worker rewrites loops in command handlers; coordinate to avoid merge conflicts.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.C](./PLAN.md).

## Your Mission

Rewire sequence execution so **each file flows through the full sequence independently** rather than the current step-by-step batch model. Today, step B waits for step A to finish ALL files; new model is rxjs composition where file 1 hits step 3 while file 2 is still on step 1.

This is **the biggest architectural shift in the plan**. Opus rating reflects the failure-mode severity: "looks right, drops files silently" or "looks right, deadlocks under back-pressure" are the kinds of bugs that emerge here.

### Today's model (read first)

Per the exploration of [sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) and a representative command like [copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts):

- Sequence runner: outer `await runOneStep(step)` loop. Each step's promise resolves only when its inner Observable completes — i.e., after every file has been processed.
- Command handler (`copyFiles`): receives a `getFilesAtDepth` Observable, calls `.pipe(toArray())` to materialize the full file list, then `concatMap`s over the array running per-file Tasks via the global scheduler.
- Parallel groups: use `forkJoin` with fail-fast semantics.

The net effect: per-step parallelism (across files via the scheduler) exists, but the **step boundary serializes**. A sequence with steps A → B → C and 100 files spends `time(A) + time(B) + time(C)` per file as a serial pipeline of batches.

### New model

Compose steps as observable transforms; the outer "loop" is `mergeMap` (or `concatMap` where ordering matters), not `await`:

```ts
// Pseudocode for the new sequenceRunner
const runSequence = (sequence, files$) =>
  sequence.steps.reduce(
    (pipeline$, step) =>
      pipeline$.pipe(
        mergeMap((fileContext) => runStepForFile(step, fileContext))
      ),
    files$
  )
```

Now file 1 leaves step A's mergeMap and enters step B before step A is done with file 2. The full file list never gets materialized to an array.

### Implementation scope

#### 1. Rewrite `sequenceRunner.ts`

- Replace the `await runOneStep` loop with `reduce` over steps + `mergeMap` composition (or whatever rxjs operator chain fits — `concatMap` if ordering across files must be preserved within a step).
- Preserve fail-fast for parallel groups.
- Preserve the per-step `JobStatus` transitions (running → completed/failed/skipped); now multiple step-level statuses are concurrent across in-flight files.
- The structured logging from worker 28 should give you trace IDs to follow individual files through the pipeline — leverage this heavily for debugging.

#### 2. Update every command handler to be observable-composable

Today each command handler returns an Observable but materializes early via `toArray()` or similar. Audit each handler and drop the materialization where possible:

- **`copyFiles`** ([copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts)) — drop `toArray()` at line ~49; let `getFilesAtDepth`'s stream flow directly into the per-file copy `runTasks`. Be careful: the pre-calculated total size for progress display might depend on `toArray` — if so, emit progress per-file instead (`bytesProcessed / totalBytesSeenSoFar`) or pre-scan separately if total-bytes accuracy is required.
- **Other handlers** under [packages/server/src/app-commands/](../../packages/server/src/app-commands/) — audit each. Most should be similar in shape.
- Handlers that genuinely need full-set knowledge (e.g., to deduplicate or sort) can still call `toArray()` but become **stream-breakers**: they materialize internally and emit a single batch downstream. Document each stream-breaker in the PR description.

#### 3. Update `getFilesAtDepth` callers

Today's [getFilesAtDepth.ts](../../packages/server/src/tools/getFilesAtDepth.ts) already returns a streaming Observable — good. But callers that immediately `toArray()` lose the streaming benefit. Audit and remove unnecessary materialization.

If any caller uses `.subscribe` to count files first (e.g., for progress total), consider replacing with a `share()` + parallel-count strategy, or accept that the total updates as files are discovered.

#### 4. Per-file progress reporting

Today's progress is per-step (e.g., "step 3 of 5: 23/47 files done"). New model: progress should reflect per-file pipeline position (e.g., "file 23 on step 3; file 47 on step 1; total 100 in flight").

UI implications:
- The Jobs screen shows job-level progress today. Either:
  - **A. Aggregate the new per-file progress back to a job-level number** (e.g., `sum of files * steps that completed / total files * total steps`). Simpler; preserves today's UX. Recommended.
  - **B. Show per-file rows in the Jobs screen.** Bigger UX change; out of scope for this worker unless trivial to add.

Pick A unless adding B is mechanical.

### Out of scope

- Per-step thread caps (worker 11 only does per-sequence; per-step would be a follow-up worker).
- File-level retry on partial pipeline failures (today: job-level retry only; per-file retry is a future worker).
- Reordering files based on pipeline pressure (each step runs at its natural rate; no priority queue).
- Changing the `JobStatus` enum (still `pending`/`running`/`completed`/`failed`/`paused`/`skipped`).

### Risk areas — investigate carefully

1. **Back-pressure between steps with very different per-file times.** If step A is fast (e.g., probe metadata) and step B is slow (e.g., transcode), `mergeMap` will queue up an unbounded backlog at step B's input. Use `mergeMap(concurrent)` with a concurrency parameter, OR explicit buffering with backpressure — pick based on what rxjs operators give you cleanly.
2. **Failure semantics.** Today: step A failure cancels step B. New: file 1 failing at step A shouldn't prevent file 2 from continuing. But a CATASTROPHIC error (e.g., disk full) should fail the whole job. Define and test both cases.
3. **Parallel-group fail-fast.** Existing `forkJoin` fail-fast must still work — when one parallel group's branch fails, sibling branches cancel.
4. **Observable cleanup on cancellation.** Mid-pipeline cancellation must clean up in-flight files in all steps. Use `takeUntil(cancelSignal$)` or similar.
5. **Test fixtures.** The new model changes timing characteristics — existing tests that depend on serial step completion may need updates.

## Tests (per test-coverage discipline)

This worker's tests are the safety net for a high-risk refactor:

- **Unit:** `sequenceRunner` composes 2-step sequence; emits per-file events showing file 1 on step 2 before file 2 on step 1 (fake handlers with controllable timing).
- **Unit:** failure of file 1 at step A doesn't block file 2 from continuing.
- **Unit:** catastrophic failure (handler throws) fails the whole job and cancels in-flight files.
- **Unit:** parallel-group fail-fast still works.
- **Unit:** cancellation cleans up all in-flight files across steps.
- **Integration:** real command handlers (`copyFiles`, etc.) work in the new streaming model — files actually copy correctly, no dropped or duplicated files.
- **Integration:** progress aggregation is monotonic and reaches 100%.
- **e2e:** a 3-step sequence with 5 files completes; total wall-clock is shorter than the serial baseline (this is the proof that pipelining actually overlaps).
- **e2e:** combined with worker 11's per-job thread budget — a job with `threadCount: 8` actually uses up to 8 in-flight tasks across all steps (not just within one step).

## TDD steps

1. Write all failing tests above. Commit each as `test(...): failing test for <case>`.
2. Sketch the new `sequenceRunner` skeleton with fake handlers; get unit tests passing.
3. Migrate `copyFiles` handler.
4. Migrate remaining handlers one at a time; integration tests pass per handler.
5. Wire progress aggregation.
6. Run full e2e suite.

## Files

- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — primary rewrite
- All `packages/server/src/app-commands/*.ts` — audit each; drop unnecessary `toArray()`s
- [packages/server/src/tools/getFilesAtDepth.ts](../../packages/server/src/tools/getFilesAtDepth.ts) — keep streaming; verify no caller forces materialization
- [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts) — progress aggregation
- Possibly: [packages/web/src/components/JobCard/JobCard.tsx](../../packages/web/src/components/JobCard/JobCard.tsx) — UI progress display tweaks
- Tests for all of the above

## Verification checklist

- [ ] Workers 20, 21, 28 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first (covering each risk area)
- [ ] `sequenceRunner.ts` composes via observable operators (no `await runOneStep` loop)
- [ ] All command handlers audited; `toArray()` calls justified or removed
- [ ] Stream-breakers (handlers that legitimately must materialize) documented in PR
- [ ] Per-file failure isolation works (file 1 fails, file 2 continues)
- [ ] Catastrophic failure still terminates the job
- [ ] Parallel-group fail-fast still works
- [ ] Cancellation cleans up in-flight files
- [ ] Progress aggregation monotonic; reaches 100%
- [ ] e2e proves overlap: wall-clock for 3-step + 5-file sequence < serial baseline
- [ ] e2e proves worker-11 thread budget hits its ceiling across steps
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Why Opus

Per the plan's model-recommendation confidence table: this worker is in the "Low — model uncertain" bucket. Opus is chosen because:

1. Failure modes are subtle (silent drops, deadlocks) and the AI can't reliably catch them via test-pass alone.
2. rxjs composition has many sharp edges; "looks right, drops messages" is common.
3. The downstream value (multiplies worker 11's thread budget; enables future per-file UX) is high enough to justify the Opus cost.

If the user prefers Sonnet/High here, budget time for a careful second pass with extra integration tests targeting the risk areas.
