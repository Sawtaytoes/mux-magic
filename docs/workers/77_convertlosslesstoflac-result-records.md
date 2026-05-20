# Worker 77 — convertLosslessToFlac result records on the JobCard

**Status:** ready
**Track:** srv
**Model:** Haiku
**Effort:** Low
**Thinking:** OFF
**Phase:** 5
**Depends:** 50 (merged — introduced the command)
**Branch:** `worker-77-convertlosslesstoflac-result-records`
**Worktree:** `.claude/worktrees/77_convertlosslesstoflac-result-records/`
**Parallel with:** any worker not touching [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) or [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Why

After a successful `Convert Lossless Audio to FLAC` run, the JobCard shows `completed`, a `Logs (N lines)` disclosure, and nothing specific to *what got converted*. To see which files were touched, the user has to expand the raw log block and scan for `CREATED FLAC FILE` lines. Sibling file-touching commands (`copyFiles`, `moveFiles`, `renameFiles`) avoid this — they emit a structured `{ source, destination }` record per file, which the JobCard renders as a `Results (N)` disclosure (each record pretty-printed) via the existing block at [JobCard.tsx:176-193](../../packages/web/src/components/JobCard/JobCard.tsx#L176-L193).

`convertLosslessToFlac` doesn't emit any records. Its pipeline ends:

```ts
withFileProgress((fileInfo) =>
  convertLosslessToFlac({ filePath: fileInfo.fullPath, isSourceDeleted }).pipe(
    tap(() => logInfo("CREATED FLAC FILE", outputFilePath)),
    filter(Boolean),
  )
)
```

The cli-spawn-op emits something unstructured (a path string or `void` — confirm during read), and worker 50 wired the route in [commandRoutes.ts:233-244](../../packages/api/src/api/routes/commandRoutes.ts#L233-L244) without an `extractOutputs` block. So the card has nothing structured to surface, *and* downstream linked steps have no `convertedSourcePaths` / `convertedDestinationPaths` to consume.

Mirroring the `copyFiles` / `CopyRecord` template fixes both gaps in one ~3-file change.

## What

Three coordinated edits:

### 1. App-command emits a per-file record

In [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts), after the successful inner-observable emit from the cli-spawn-op, `map` to:

```ts
export type ConvertLosslessToFlacRecord = {
  destination: string
  isSourceDeleted: boolean
  source: string
}
```

The `isSourceDeleted` field reflects whether the unlink actually ran. Today the unlink only runs after a successful ffmpeg emit (see worker 50 spec), so `record.isSourceDeleted === props.isSourceDeleted` for every emitted record — but tracking it per-record keeps the shape resilient to future failure-skip semantics without a schema break.

Keep the existing `logInfo("CREATED FLAC FILE", outputFilePath)` line — structured records on the card and human-readable log lines serve different surfaces.

### 2. Type exported in-place

Match the [copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) sibling pattern: `CopyRecord` is exported from the app-command file (not pushed into `@mux-magic/tools`). Same here — export `ConvertLosslessToFlacRecord` from `convertLosslessToFlac.ts` so the route file can `import { type ConvertLosslessToFlacRecord }` for the cast inside `extractOutputs`.

### 3. Route gains `extractOutputs`

In [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) (lines 233-244), add:

```ts
extractOutputs: (results) => ({
  convertedDestinationPaths: (results as ConvertLosslessToFlacRecord[]).map(r => r.destination),
  convertedSourcePaths: (results as ConvertLosslessToFlacRecord[]).map(r => r.source),
}),
```

Field-name convention follows the existing `copiedSourcePaths` precedent at [commandRoutes.ts:256-260](../../packages/api/src/api/routes/commandRoutes.ts#L256-L260). No web-side changes — the JobCard `Results` disclosure renders `job.results` directly.

If worker 69 (LinkPicker type-tagged outputs) has merged by the time this worker runs, also tag both outputs with `valueType: "pathArray"` per the worker-69 schema. If 69 is still `ready`, leave that out — 69 will sweep this entry along with all the others.

## TDD steps

1. **Failing test** in [packages/core/src/app-commands/convertLosslessToFlac.test.ts](../../packages/core/src/app-commands/convertLosslessToFlac.test.ts):
   - Single `.wav` input with `isSourceDeleted: false` → emitted record equals `{ source: "<input>", destination: "<input>.flac" (extension swapped), isSourceDeleted: false }`. Inline-expected — no snapshots.
   - Same input with `isSourceDeleted: true` + mocked successful `unlink` → `isSourceDeleted: true` on the record.
   - `.flac` / `.mp3` / `.mkv` siblings in the same dir → zero records emitted (extension filter still wins).
   - Use `lastValueFrom(pipeline.pipe(toArray()))` per existing pattern in the file.
2. **Failing route test** — only if a `commandRoutes` extractOutputs harness exists (grep `extractOutputs` in `packages/api/`). If none, skip; the app-command test plus the parity fixture roundtrip cover the shape.
3. Implement until green. **Two commits: red first, green second** per the AGENTS.md TDD convention.
4. **Parity fixture** — verify [packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json) (and any `.yaml` sibling) still roundtrips. The *input* shape is unchanged; only *output* records gain a new key.
5. Standard gate: `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`.

## Files

### Extend

- [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) — add `map(() => record)` between the cli-spawn-op emit and the existing `tap(() => logInfo(…))`; export `ConvertLosslessToFlacRecord` type.
- [packages/core/src/app-commands/convertLosslessToFlac.test.ts](../../packages/core/src/app-commands/convertLosslessToFlac.test.ts) — add record-shape assertions; extend skip-cases to assert *no* records emit for `.flac`/`.mp3`/`.mkv` inputs.
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — add `extractOutputs` block on the `convertLosslessToFlac` route entry.

### Verify

- [packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json) — roundtrip green.

### Reuse — do not reinvent

- [copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) — `CopyRecord` shape + per-file `map`. Exact template.
- [commandRoutes.ts:256-260](../../packages/api/src/api/routes/commandRoutes.ts#L256-L260) — `copiedSourcePaths` extractOutputs precedent for field naming.
- [moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts) and [renameFiles.ts](../../packages/core/src/app-commands/renameFiles.ts) — same record pattern in slightly different shapes; sanity-check naming.

## Verification checklist

- [ ] Worktree at `.claude/worktrees/77_convertlosslesstoflac-result-records/`
- [ ] Manifest row flipped to `in-progress` in its own `chore(manifest):` commit at the start
- [ ] Failing-test commit precedes green-implementation commit
- [ ] `Results (N)` disclosure appears on the JobCard after running a real `.wav` → `.flac` conversion locally
- [ ] Each rendered record has `source`, `destination`, `isSourceDeleted` keys
- [ ] `logInfo("CREATED FLAC FILE", …)` line is preserved (still readable in raw logs)
- [ ] Parity fixture roundtrips
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] Manifest row flipped to `done` after merge per [feedback_workers_flip_own_done](../../C%3A/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_workers_flip_own_done.md)
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- No JobCard layout changes — the existing `Results (N)` disclosure is the surface.
- No removal or rewording of `CREATED FLAC FILE` log lines.
- No retroactive backfill of records for historical jobs.
- No `valueType: "pathArray"` annotation if worker 69 hasn't merged yet — 69 sweeps this site along with every other route.
- No `extractOutputs` for `replaceFlacWithPcmAudio` / `convertFlacToPcmAudio` / other audio commands. Same gap exists, but each is a separate decision; tackle one at a time.
