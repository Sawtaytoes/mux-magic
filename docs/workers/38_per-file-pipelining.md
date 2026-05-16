# Worker 38 — per-file-pipelining

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/38-per-file-pipelining`
**Worktree:** `.claude/worktrees/38_per-file-pipelining/`
**Phase:** 4 (server infrastructure)
**Depends on:** 20 (CLI extract), 21 (observables-shared-split), 41 (structured-logging — needed for trace IDs to follow individual files through the pipeline; was originally id `28` before reassignment)
**Parallel with:** Other Phase 4 workers that don't touch sequenceRunner or command handlers (2a server-template-storage). NOT parallel with 2c (pure-functions-sweep) — that worker rewrites loops in command handlers; coordinate to avoid merge conflicts.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.C](./PLAN.md).

## Your Mission

Rewrite the sequence runner AND every command handler so each file streams through the full sequence independently — file 1 hits step 3 while file 2 is still on step 1. The folder-level handler contract (`{ sourcePath, … } → Observable<unknown>`) goes away. Every command becomes an **rxjs operator** over `Observable<FileContext>`. The runner becomes a single `reduce → mergeMap` chain. Folder-level callers (single-step HTTP routes, CLI invocations) reach the new contract via a generic `wrapAsSourcePath` adapter.

This is **the biggest architectural shift in the plan**. The wide blast radius is intentional — it eliminates the fork between "solo command" and "pipelined sequence" code paths so users never have to think about pipelining boundaries.

> **Design history — read this before planning.** Three architectural shapes were considered, each captured as a code sketch:
>
> - [shape1-coexist-perfile.ts](38-sketches/shape1-coexist-perfile.ts) — every command has TWO functions (folder + per-file), runner forks. Rejected: permanent dual maintenance.
> - [shape2-implicit-source.ts](38-sketches/shape2-implicit-source.ts) — every command has ONE per-file contract, runner has ONE code path. **CHOSEN.** The sketch shows the per-file-handler variant; the refined model in this worker doc uses an **operator** contract (handler takes the upstream Observable + params, returns downstream) so stream-breakers fit the same signature.
> - [shape3-foreachfiles.ts](38-sketches/shape3-foreachfiles.ts) — opt-in `forEachFiles` group kind. Rejected: forces users to manage pipelining boundaries.

### Today's model (read first)

Per the exploration of [sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) and a representative command like [copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts):

- Sequence runner: outer `await runOneStep(step)` loop at [sequenceRunner.ts:668](../../packages/server/src/api/sequenceRunner.ts#L668). Each step's promise resolves only when its inner Observable completes — i.e., after every file has been processed.
- Command handler (`copyFiles`): receives a `getFiles`/`getFilesAtDepth` Observable, calls `.pipe(toArray())` to materialize the full file list, then iterates with `concatMap` + `runTasks` for per-file work.
- Parallel groups: `Promise.all` with first-failure broadcast cancellation ([sequenceRunner.ts:486-608](../../packages/server/src/api/sequenceRunner.ts#L486-L608)).

Net effect: per-step parallelism exists (via the task scheduler) but the **step boundary serializes**. A 3-step × 100-file sequence runs as three back-to-back batches.

### New model — Shape 2 with operator handlers

Every command handler is an **rxjs operator over `Observable<FileContext>`**:

```ts
type FileContext = {
  fullPath: string                       // current path as the file moves through the chain
  metadata: Record<string, unknown>      // free-form bag (e.g. originalSource for cleanup steps)
}

type CommandHandler<Params> = (
  params: Params,
  upstream$: Observable<FileContext>,
) => Observable<FileContext>
```

Per-file handler (most commands) — `mergeMap` internally so files race:

```ts
export const copyFiles: CommandHandler<{ destinationPath: string }> = (
  { destinationPath },
  upstream$,
) =>
  upstream$.pipe(
    mergeMap((fileContext) =>
      copyOneFile(fileContext.fullPath, destinationPath).pipe(
        map((newPath) => ({
          fullPath: newPath,
          metadata: {
            ...fileContext.metadata,
            originalSource: fileContext.fullPath,
          },
        })),
      ),
    ),
  )
```

Stream-breaker (full-set commands) — `toArray()` internally, same signature:

```ts
export const nameTvShowEpisodes: CommandHandler<NameParams> = (
  params,
  upstream$,
) =>
  upstream$.pipe(
    toArray(),
    mergeMap((allFiles) => /* compute episode order across the set */),
    // emit each rename as an individual FileContext
  )
```

The sequence runner is a single `reduce → mergeMap`. Per the user's "user has the choice at any stage to use the file context or define a source path" requirement, each step has an OPTIONAL `sourcePath` — when set, the step starts a fresh stream; when omitted, it inherits upstream:

```ts
const runSequence = (body: SequenceBody): Observable<FileContext> =>
  body.steps.reduce<Observable<FileContext>>((upstream$, step) => {
    const stepUpstream$ = step.sourcePath
      ? getFilesAtDepth({ sourcePath: step.sourcePath, depth: step.depth ?? 0 })
      : upstream$
    return commands[step.command](step.params, stepUpstream$)
  }, EMPTY)
```

Validation rejects sequences whose first step has no `sourcePath` (upstream is `EMPTY` — nothing would flow). No `forEachFiles` group construct. No flag. One code path.

### Folder-level callers — the `wrapAsSourcePath` adapter

HTTP routes for direct command invocation, CLI one-offs, scripts that want "give this command a sourcePath and get results back" — they reach the new contract through a generic wrapper that lives alongside `getFilesAtDepth`:

```ts
export const wrapAsSourcePath = <Params>(handler: CommandHandler<Params>) =>
  ({
    sourcePath,
    depth = 0,
    ...params
  }: Params & { sourcePath: string; depth?: number }): Observable<FileContext> =>
    handler(
      params as Params,
      getFilesAtDepth({ sourcePath, depth }),
    )
```

Every route under [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) that today calls `command.getObservable({ sourcePath, ...params })` switches to `wrapAsSourcePath(command.handler)({ sourcePath, ...params })`. Behavior preserved; contract unified.

### Stream-breakers (the full-set-knowledge case)

These commands genuinely need to see every file before they can act. They internally `toArray()` and re-emit. Same operator signature.

- **`nameTvShowEpisodes`, `nameAnimeEpisodes`, `nameAnimeEpisodesAniDB`** — **order-dependent.** Episode numbers are assigned by sort order across the full set; file 1 of 100 can't be named "episode 1" until every file is in hand to confirm there isn't a missing earlier one.
- **`nameSpecialFeaturesDvdCompareTmdb`, `nameMovieCutsDvdCompareTmdb`** — **duplicate-aware.** A candidate match for a special feature isn't decided until every candidate is in hand so the disambiguation logic can compare ([per the user: "nameSpecialFeatures has to deal with duplicates intelligently, and that's why it can't finish until all files are there"](https://example/design-discussion)).
- **Likely also** `renameDemos`, `renameMovieClipDownloads`, `renumberChapters` — confirm per-handler during the rewrite based on each command's actual semantics.

Stream-breakers HALT cross-step concurrency at their position in the chain — by definition, they have to wait for the full upstream before downstream sees anything. That's the correct semantics for these commands and explicitly fine per the user. UI should indicate "buffering N files" while the toArray fills, then resume normal progress for downstream steps.

### UI: per-step source mode

In the Builder UI ([packages/web/src/pages/BuilderPage/](../../packages/web/src/pages/BuilderPage/) + [StepCard.tsx](../../packages/web/src/components/StepCard/StepCard.tsx)), every step gets a **source mode** picker (default: "inherit upstream"):

- **Inherit upstream** — step has no `sourcePath`; runner threads upstream `FileContext$` into the handler.
- **Define source path** — step has its own `sourcePath` (+ optional depth); runner discards upstream and gives the handler a fresh `getFilesAtDepth(...)`.

The first step in any sequence forces "Define source path" mode (there is no upstream). The picker is the user-facing concrete of the "wrap it in a sourcePath reader" affordance — it's the same `wrapAsSourcePath` adapter, surfaced as a step-level toggle instead of a separate code path.

### Per-file progress reporting

- Progress is per-file pipeline position across the whole sequence. Aggregate to a single job-level number for the Jobs screen — `(sum of (file × steps_completed)) / (total_files × total_steps)`. Same UX surface as today; the math changes.
- Stream-breaker steps emit a "buffering N files" indicator while their toArray fills.

### Out of scope

- Per-step thread caps (worker 11 only does per-sequence; per-step would be a follow-up).
- File-level retry on partial pipeline failures (today: job-level retry only; per-file retry is a future worker).
- Reordering files based on pipeline pressure (each step runs at its natural rate; no priority queue).
- Changing the `JobStatus` enum.

### Risk areas — investigate carefully

1. **Wide blast radius.** ~50 command handlers rewritten, every test fixture rewritten, sequence YAML codec updated, every HTTP route under `commandRoutes.ts` switched to `wrapAsSourcePath`. This is a multi-commit refactor. Land the new runner + adapter + 2-3 migrated handlers first; migrate the rest in batches behind passing tests.
2. **Back-pressure between fast and slow steps.** If step A is fast (probe metadata) and step B is slow (transcode), unbounded `mergeMap` queues backlog at B's input. Use `mergeMap(handler, concurrency)` capped at the job's threadCount.
3. **Failure isolation.** File 1 failing at step A shouldn't prevent file 2 from continuing. But a CATASTROPHIC error (disk full, handler throws synchronously) should fail the whole job.
4. **Cancellation cleanup.** Mid-pipeline cancellation must clean up in-flight per-file work at every step. Use `takeUntil(cancelSignal$)` or similar; verify the abort signal reaches per-file Tasks.
5. **Migration of existing direct-command HTTP routes.** Today's `/api/commands/:name` endpoints (or whatever shape they're in) call handlers with `{ sourcePath, ...params }`. After the rewrite they go through `wrapAsSourcePath`. Test each route's behavior is preserved.
6. **Stream-breaker UI semantics.** Downstream steps appear "queued" while a stream-breaker buffers. Make this legible — the UI should show "Step N waiting on Step M (buffering N files)".
7. **Parallel/serial group semantics.** Today's `kind: "group"` items (parallel/serial sub-lists) — decide whether they survive the rewrite or fold into the new model. Parallel groups today rely on independent step-level observables; in Shape 2 they become parallel branches of the upstream stream. Preserve external behavior; internal mechanism may change.
8. **Validation up-front.** Reject sequences where step 1 has no `sourcePath` at parse time, not runtime.

## Tests (per test-coverage discipline)

The safety net for the highest-risk worker in the plan. Stream-breaker correctness is the easiest place for silent bugs to hide.

- **Unit:** runner composes 2 per-file handlers; file 1 reaches step 2 before file 2 reaches step 1 (fake handlers with controllable timing).
- **Unit:** stream-breaker handler correctly buffers upstream via `toArray()`, processes the full set, emits each result downstream.
- **Unit:** per-step `sourcePath` override discards upstream and starts a fresh stream.
- **Unit:** file 1 failing at step A doesn't block file 2 from continuing through both steps.
- **Unit:** catastrophic failure (handler throws synchronously) fails the whole job and cancels in-flight per-file work.
- **Unit:** `wrapAsSourcePath` adapter exposes folder-level interface and threads `getFilesAtDepth` into the operator handler.
- **Unit:** validation rejects a sequence whose first step has no `sourcePath`.
- **Unit:** existing parallel-group fail-fast semantics preserved (or migration equivalent documented in PR).
- **Unit:** cancellation cleans up in-flight files across all step positions.
- **Integration:** every migrated handler's external behavior is preserved (one test per handler — these are the regression nets for the rewrite).
- **Integration:** every direct-command HTTP route still returns the same shape via `wrapAsSourcePath`.
- **Integration:** progress aggregation is monotonic and reaches 100%.
- **e2e:** 3-step sequence with 5 files completes; wall-clock < serial baseline (proof of overlap).
- **e2e:** worker-11 per-job thread budget hits its ceiling across all steps (not just within one step).
- **e2e:** sequence containing a stream-breaker mid-chain — downstream waits, then resumes correctly.

## TDD steps

1. Write failing tests for the runner shape, stream-breaker pattern, per-step source override, `wrapAsSourcePath` adapter. Commit each as `test(...): failing test for <case>`.
2. Build the new runner skeleton + `wrapAsSourcePath` adapter; get unit tests passing.
3. Migrate `copyFiles` (per-file) — integration test passes.
4. Migrate `mergeTracks`, `extractSubtitles`, other per-file commands in small batches.
5. Migrate stream-breakers (`nameTvShowEpisodes`, `nameAnimeEpisodes*`, `nameSpecialFeaturesDvdCompareTmdb`, etc.) — these need care; one at a time with full integration coverage.
6. Switch every direct-command HTTP route to `wrapAsSourcePath`.
7. Update sequence YAML codec + Builder UI: per-step source-mode picker; validation for first-step `sourcePath`.
8. Wire progress aggregation.
9. Run full e2e suite.

## Files

- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — full rewrite to single `reduce → mergeMap` chain
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — `CommandConfig` shape changes; every route switches to `wrapAsSourcePath`
- `packages/tools/src/wrapAsSourcePath.ts` (new) — the generic folder-level adapter; exported from `@mux-magic/tools`
- `packages/tools/src/FileContext.ts` (new) — shared `FileContext` type and helpers
- **All** `packages/server/src/app-commands/*.ts` — every handler rewritten to operator signature
- **All** `packages/server/src/app-commands/*.test.ts` — every test fixture rewritten
- [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts) — progress aggregation
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — per-step `sourcePath` encode/decode (likely already supported via worker 24, verify)
- [packages/web/src/pages/BuilderPage/](../../packages/web/src/pages/BuilderPage/) + [packages/web/src/components/StepCard/StepCard.tsx](../../packages/web/src/components/StepCard/StepCard.tsx) — per-step source-mode picker
- [packages/web/src/state/groupAtoms.ts](../../packages/web/src/state/groupAtoms.ts) — review whether existing group kinds need migration
- [docs/workers/38-sketches/](38-sketches/) — design artifacts (chosen shape + rejected alternatives)

## Verification checklist

- [ ] Workers 20, 21, 41 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first (covering each risk area)
- [ ] `CommandHandler` operator type defined; `FileContext` type exported from `@mux-magic/tools`
- [ ] `wrapAsSourcePath` adapter implemented and tested
- [ ] Sequence runner reduced to single `reduce → mergeMap` chain (no fork between solo and pipelined paths)
- [ ] Per-step `sourcePath` override implemented; first-step validation rejects missing source
- [ ] Every command handler migrated to operator signature
- [ ] Every command handler's external behavior preserved (integration test per handler)
- [ ] Stream-breakers identified, marked, and verified (named commands: `nameTvShowEpisodes`, `nameAnimeEpisodes*`, `nameSpecialFeaturesDvdCompareTmdb`, `nameMovieCutsDvdCompareTmdb`, plus any others surfaced during rewrite)
- [ ] Every direct-command HTTP route switched to `wrapAsSourcePath`
- [ ] UI per-step source-mode picker wired (inherit upstream vs define `sourcePath`)
- [ ] Per-file failure isolation works (file 1 fails, file 2 continues)
- [ ] Catastrophic failure terminates the job
- [ ] Cancellation cleans up in-flight per-file work
- [ ] Progress aggregation monotonic; reaches 100%
- [ ] e2e proves overlap: wall-clock for 3-step + 5-file sequence < serial baseline
- [ ] e2e proves worker-11 thread budget hits its ceiling across steps
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Why Opus

Per the plan's model-recommendation confidence table: this worker is in the "Low — model uncertain" bucket. Opus is chosen because:

1. Failure modes are subtle (silent drops, deadlocks, stream-breaker buffer leaks) and the AI can't reliably catch them via test-pass alone.
2. rxjs composition has many sharp edges; "looks right, drops messages" is common.
3. The wide blast radius (~50 handlers + every test + every direct-command route) demands consistent migration discipline.
4. The downstream value (multiplies worker 11's thread budget across every sequence; enables future per-file UX; unifies the solo-command and sequence code paths) is high enough to justify the Opus cost.

The original "biggest architectural shift in the plan" rating stands — if anything strengthened, because Shape 2 was chosen over the smaller-blast-radius Shape 3.
