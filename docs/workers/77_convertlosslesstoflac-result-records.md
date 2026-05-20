# Worker 77 — convertLosslessToFlac result records + float/DSD skip + audit-only mode

**Status:** ready
**Track:** srv
**Model:** Sonnet
**Effort:** Medium
**Thinking:** ON
**Phase:** 5
**Depends:** 50 (merged — introduced the command)
**Branch:** `worker-77-convertlosslesstoflac-result-records`
**Worktree:** `.claude/worktrees/77_convertlosslesstoflac-result-records/`
**Parallel with:** any worker not touching [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) or [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Why

After a successful `Convert Lossless Audio to FLAC` run, the JobCard shows `completed`, a `Logs (N lines)` disclosure, and nothing specific to *what got converted*. To see which files were touched, the user has to expand the raw log block and scan for `CREATED FLAC FILE` lines. Sibling file-touching commands (`copyFiles`, `moveFiles`, `renameFiles`) avoid this — they emit a structured `{ source, destination }` record per file, which the JobCard renders as a `Results (N)` disclosure (each record pretty-printed) via the existing block at [JobCard.tsx:176-193](../../packages/web/src/components/JobCard/JobCard.tsx#L176-L193).

There is also a **silent-downconversion bug** in the same surface: [filterIsLosslessAudioFile.ts](../../packages/core/src/tools/filterIsLosslessAudioFile.ts) accepts inputs by extension only, with no sample-format probe. A 32-bit-float WAV (common for DAW exports / game soundtracks) passes the extension filter, ffmpeg's flac encoder silently coerces float → 24-bit integer (FLAC is integer-PCM only), and the user gets a "valid" FLAC that is **not bit-exact** with the source. DSD sources (`.dsf` / `.dff`) aren't currently in the extension allowlist so this command doesn't touch them today — but the probe step we're adding catches DSD if it ever sneaks in via an unusual container.

Observed in the wild on a soundtrack folder of 32-bit-float WAV exports: every source reported `sample_fmt=flt` via `ffprobe` and decoded to 32-bit samples, but every produced FLAC was 24-bit and the decoded PCM (`ffmpeg -f md5 -`) hashed differently from the source — confirming silent lossy coercion at the encoder.

Both gaps share the same pipeline edit, so they're fixed together. The probe-and-skip behavior is also exposed via a new **`isAuditOnly`** prop (a checkbox in the UI) — when set, the command performs the probe and emits records for every input (converted-candidate or skipped), but **never invokes ffmpeg**. This is the "scan my whole library to see what would be skipped and why" workflow.

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

Five coordinated edits:

### 1. App-command emits a discriminated per-file record

In [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts), the pipeline emits one record per surviving input — either a successful conversion or a structural skip:

```ts
export type ConvertLosslessToFlacConvertedRecord = {
  destination: string
  isSourceDeleted: boolean
  kind: "converted"
  source: string
}

export type ConvertLosslessToFlacSkippedRecord = {
  kind: "skipped"
  reason: ConvertLosslessToFlacSkipReason
  source: string
}

export type ConvertLosslessToFlacSkipReason =
  | "audit-only"      // isAuditOnly was true; would have converted
  | "float-pcm"       // sample_fmt ∈ {flt, fltp, dbl, dblp} — FLAC is integer-only
  | "dsd"             // codec is DSD — FLAC is PCM-only

export type ConvertLosslessToFlacRecord =
  | ConvertLosslessToFlacConvertedRecord
  | ConvertLosslessToFlacSkippedRecord
```

The `isSourceDeleted` field on the converted variant reflects whether the unlink actually ran (only after a successful ffmpeg emit per worker 50). The `skipped` variant deliberately omits `destination` — no file was produced. Splitting via `kind` (rather than nullable fields) makes consumers branch explicitly and avoids "is this a skip or a conversion?" guesswork at the route and UI layers.

Keep the existing `logInfo("CREATED FLAC FILE", outputFilePath)` line for converted records. Add a parallel `logInfo("SKIPPED FLAC SOURCE", { source, reason })` line for skipped records. Structured records on the card and human-readable log lines continue to serve different surfaces.

### 2. Probe step before encode

Insert an rxjs operator between `filterIsLosslessAudioFile()` and `withFileProgress(...)` that calls `getMediaInfo` ([packages/core/src/tools/getMediaInfo.ts](../../packages/core/src/tools/getMediaInfo.ts)) and emits **either** the original `FileInfo` (compatible — proceed to encode) **or** a pre-built `ConvertLosslessToFlacSkippedRecord` (incompatible — short-circuit, never reach ffmpeg).

Detection rules (read off the first `"@type": "Audio"` track):

- `Format === "DSD"` (or codec/Format starts with `DSD`) → `reason: "dsd"`
- `Format_Settings_Floating_Point === "Yes"` → `reason: "float-pcm"`
- Otherwise → compatible

`Format_Settings_Floating_Point` is not currently in the [MediaInfo `AudioTrack` type](../../packages/core/src/tools/getMediaInfo.ts) — add it as `Format_Settings_Floating_Point?: "Yes" | "No"`. Same pattern as existing optional `Format_Settings_*` siblings on the type. No runtime cost; just type completeness.

Implementation shape: a new helper `packages/core/src/tools/getIsLosslessFlacCompatible.ts` that takes a `FileInfo`, returns `Observable<{ kind: "compatible", fileInfo: FileInfo } | { kind: "skip", reason: ConvertLosslessToFlacSkipReason }>`. Then a `mergeMap` in the app-command branches on `kind`.

### 3. New `isAuditOnly` prop (dry-run)

Add to `ConvertLosslessToFlacOptionalProps`:

```ts
isAuditOnly?: boolean   // default false
```

When `true`: the probe still runs, skipped files still emit `skipped` records as usual, *and* compatible files emit a `skipped` record with `reason: "audit-only"` **instead of** invoking `convertLosslessFileToFlac`. No ffmpeg call. No file writes. This is the "scan a whole music library and tell me what would happen" workflow — the user's stated intent for running this on `~/Music`.

Wire through:

- `convertLosslessToFlacRequestSchema` in [packages/api/src/api/schemas.ts:286-305](../../packages/api/src/api/schemas.ts#L286-L305) — add `isAuditOnly: z.boolean().default(false).describe(...)`.
- `convertLosslessToFlacCommand` in [packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts](../../packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts) — add `--audit-only` / `-a` boolean option, pass `argv.isAuditOnly` in the handler, add a `.example()` for the dry-run.
- Route in [packages/api/src/api/routes/commandRoutes.ts:233-244](../../packages/api/src/api/routes/commandRoutes.ts#L233-L244) — pass `isAuditOnly: body.isAuditOnly`.
- UI field copy in [packages/web/public/command-descriptions.js:29-36](../../packages/web/public/command-descriptions.js#L29-L36) — add `"isAuditOnly": "Dry-run: probe each file, report what would be converted vs. skipped (and why), but do not invoke ffmpeg or write any FLAC files."`.

### 4. Type exported in-place

Match the [copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) sibling pattern: `CopyRecord` is exported from the app-command file (not pushed into `@mux-magic/tools`). Same here — export `ConvertLosslessToFlacRecord`, `ConvertLosslessToFlacConvertedRecord`, `ConvertLosslessToFlacSkippedRecord`, and `ConvertLosslessToFlacSkipReason` from `convertLosslessToFlac.ts` so the route file can narrow the union inside `extractOutputs`.

### 5. Route gains `extractOutputs` (narrowing the union)

In [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) (lines 233-244), add:

```ts
extractOutputs: (results) => {
  const records = results as ConvertLosslessToFlacRecord[]
  const converted = records.filter(
    (r): r is ConvertLosslessToFlacConvertedRecord => r.kind === "converted",
  )
  const skipped = records.filter(
    (r): r is ConvertLosslessToFlacSkippedRecord => r.kind === "skipped",
  )
  return {
    convertedDestinationPaths: converted.map(r => r.destination),
    convertedSourcePaths: converted.map(r => r.source),
    skippedSourcePaths: skipped.map(r => r.source),
  }
},
```

Skipped sources get their own output array so downstream linked steps can act on them (e.g. a follow-up "move skipped files to a `to-wavpack/` subfolder" command). Converted paths keep the established field names from the `copiedSourcePaths` precedent at [commandRoutes.ts:256-260](../../packages/api/src/api/routes/commandRoutes.ts#L256-L260). No web-side changes — the JobCard `Results` disclosure renders `job.results` directly, and `kind`-tagged records will display naturally.

If worker 69 (LinkPicker type-tagged outputs) has merged by the time this worker runs, also tag the three outputs with `valueType: "pathArray"` per the worker-69 schema. If 69 is still `ready`, leave that out — 69 will sweep this entry along with all the others.

## TDD steps

1. **Failing test** in [packages/core/src/app-commands/convertLosslessToFlac.test.ts](../../packages/core/src/app-commands/convertLosslessToFlac.test.ts):
   - **Converted record shape** — single integer-PCM `.wav`, `isSourceDeleted: false` → emitted record equals `{ kind: "converted", source: "<input>", destination: "<input>.flac", isSourceDeleted: false }`. Inline-expected — no snapshots.
   - **isSourceDeleted: true** + mocked successful `unlink` → `isSourceDeleted: true` on the converted record.
   - **`.flac` / `.mp3` / `.mkv` siblings** in the same dir → zero records emitted (extension filter still wins; probe never runs on them).
   - **Float-skip** — mock `getMediaInfo` to return an audio track with `Format_Settings_Floating_Point: "Yes"` → emitted record equals `{ kind: "skipped", source: "<input>", reason: "float-pcm" }`, **and** `runFfmpeg` is **not** called for that input.
   - **DSD-skip** — mock `getMediaInfo` to return `Format: "DSD"` → `{ kind: "skipped", source: "<input>", reason: "dsd" }`, no ffmpeg call.
   - **Mixed batch** — one integer-PCM `.wav` + one float `.wav` + one DSD-tagged `.aif` → exactly one `converted` record, two `skipped` records (one `float-pcm`, one `dsd`); only one `runFfmpeg` call total.
   - **isAuditOnly: true** on an otherwise-compatible integer-PCM `.wav` → emitted record equals `{ kind: "skipped", source: "<input>", reason: "audit-only" }`, **no** `runFfmpeg` call, and the source file remains untouched (no unlink even with `isSourceDeleted: true`).
   - **Lossless guard still holds** — existing test "does not pass any resample / remix / bit-depth coercion flags" remains green for integer-PCM inputs.
   - Use `lastValueFrom(pipeline.pipe(toArray()))` per existing pattern in the file. Mock `getMediaInfo` via the same `vi.mock` style used for `runFfmpeg`.
2. **Failing test** in a new [packages/core/src/tools/getIsLosslessFlacCompatible.test.ts](../../packages/core/src/tools/getIsLosslessFlacCompatible.test.ts):
   - Returns `{ kind: "compatible", fileInfo }` for `Format: "PCM"` + `BitDepth: "16" | "24" | "32"` + no `Format_Settings_Floating_Point`.
   - Returns `{ kind: "skip", reason: "float-pcm" }` for `Format_Settings_Floating_Point: "Yes"` at every bit depth.
   - Returns `{ kind: "skip", reason: "dsd" }` for `Format: "DSD"`.
   - Edge case: `getMediaInfo` returns `media: null` (unreadable) → propagates as `skip` with a fallback reason **or** errors loudly — settle this in the worker (recommend `skip` with a new `reason: "unreadable"` variant if the call site needs it; otherwise let it throw and the pipeline's existing error logging surfaces it).
3. **Failing route test** — only if a `commandRoutes` extractOutputs harness exists (grep `extractOutputs` in `packages/api/`). If none, skip; the app-command test plus the parity fixture roundtrip cover the shape.
4. Implement until green. **Two commits: red first, green second** per the AGENTS.md TDD convention.
5. **Parity fixture** — update [packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json) and `.yaml` sibling to include `isAuditOnly: false` (default) so the roundtrip still passes with the new schema field. Output records gain `kind` plus the `skippedSourcePaths` extractOutput.
6. **Manual smoke** — run the command in `isAuditOnly: true` mode on a directory mixing integer-PCM and 32-bit-float WAVs; confirm the JobCard `Results` disclosure shows the expected mix of `converted` and `skipped` records with correct reasons, and that **zero** `.flac` files appear on disk.
7. Standard gate: `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`.

## Files

### Create

- [packages/core/src/tools/getIsLosslessFlacCompatible.ts](../../packages/core/src/tools/getIsLosslessFlacCompatible.ts) — probe helper wrapping `getMediaInfo`; returns the discriminated `{ kind: "compatible" | "skip", ... }` result.
- [packages/core/src/tools/getIsLosslessFlacCompatible.test.ts](../../packages/core/src/tools/getIsLosslessFlacCompatible.test.ts) — float / DSD / integer-PCM cases.

### Extend

- [packages/core/src/app-commands/convertLosslessToFlac.ts](../../packages/core/src/app-commands/convertLosslessToFlac.ts) — add the probe `mergeMap`, the `isAuditOnly` prop, the discriminated record `map`, and export the new record / reason types. Keep existing `logInfo("CREATED FLAC FILE", …)`; add `logInfo("SKIPPED FLAC SOURCE", { source, reason })`.
- [packages/core/src/app-commands/convertLosslessToFlac.test.ts](../../packages/core/src/app-commands/convertLosslessToFlac.test.ts) — add record-shape assertions (converted + skipped variants), float-skip, DSD-skip, `isAuditOnly`, and the mixed-batch invariant. Mock `getMediaInfo` alongside `runFfmpeg`.
- [packages/core/src/tools/getMediaInfo.ts](../../packages/core/src/tools/getMediaInfo.ts) — extend `AudioTrack` type with `Format_Settings_Floating_Point?: "Yes" | "No"`. No runtime change.
- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — extend `convertLosslessToFlacRequestSchema` with `isAuditOnly: z.boolean().default(false).describe(...)`.
- [packages/api/src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — pass `isAuditOnly` to the observable; add `extractOutputs` block with `convertedSourcePaths`, `convertedDestinationPaths`, `skippedSourcePaths`.
- [packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts](../../packages/cli/src/cli-commands/convertLosslessToFlacCommand.ts) — add `--audit-only` / `-a` boolean option, an `.example()` line, and pass `argv.isAuditOnly` through in the handler.
- [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js) — add the `isAuditOnly` field description for the JobForm checkbox label/tooltip.

### Verify

- [packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.input.json) — add `isAuditOnly: false`; roundtrip green.
- [packages/web/tests/fixtures/parity/convertLosslessToFlac.yaml](../../packages/web/tests/fixtures/parity/convertLosslessToFlac.yaml) — same.
- [packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts](../../packages/api/src/fake-data/scenarios/convertLosslessToFlac.ts) — add a scenario that emits a mix of `converted` and `skipped` records so the JobCard's `Results` rendering can be eyeballed via fake-data.

### Reuse — do not reinvent

- [copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) — `CopyRecord` shape + per-file `map`. Template for the converted record.
- [commandRoutes.ts:256-260](../../packages/api/src/api/routes/commandRoutes.ts#L256-L260) — `copiedSourcePaths` extractOutputs precedent for field naming.
- [moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts) and [renameFiles.ts](../../packages/core/src/app-commands/renameFiles.ts) — same record pattern in slightly different shapes; sanity-check naming.
- [getMediaInfo.ts](../../packages/core/src/tools/getMediaInfo.ts) — canonical probe. Do **not** introduce ffprobe shelling; the codebase has settled on MediaInfo.

## Verification checklist

- [ ] Worktree at `.claude/worktrees/77_convertlosslesstoflac-result-records/`
- [ ] Manifest row flipped to `in-progress` in its own `chore(manifest):` commit at the start
- [ ] Failing-test commit precedes green-implementation commit
- [ ] `Results (N)` disclosure appears on the JobCard after running a real integer-PCM `.wav` → `.flac` conversion locally
- [ ] Each rendered `converted` record has `kind`, `source`, `destination`, `isSourceDeleted` keys
- [ ] Each rendered `skipped` record has `kind`, `source`, `reason` keys
- [ ] Manual smoke confirmed on a 32-bit-float `.wav`: a `skipped` record with `reason: "float-pcm"` appears and **no** `.flac` is written
- [ ] Manual smoke confirmed for `isAuditOnly: true`: every compatible input emits `reason: "audit-only"`, no `.flac` files appear on disk, source files untouched even when `isSourceDeleted: true`
- [ ] `logInfo("CREATED FLAC FILE", …)` line is preserved; new `logInfo("SKIPPED FLAC SOURCE", …)` line emits with reason
- [ ] Parity fixtures (`.json` + `.yaml`) roundtrip with the new `isAuditOnly` field
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] Manifest row flipped to `done` after merge per the workers-flip-own-done rule
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- No JobCard layout changes — the existing `Results (N)` disclosure is the surface. Future polish for differentiating `converted` vs `skipped` rows visually (icon, color) is a follow-up worker, not this one.
- No removal or rewording of `CREATED FLAC FILE` log lines.
- No retroactive backfill of records for historical jobs.
- No `valueType: "pathArray"` annotation if worker 69 hasn't merged yet — 69 sweeps this site along with every other route.
- No `extractOutputs` for `replaceFlacWithPcmAudio` / `convertFlacToPcmAudio` / other audio commands. Same gap exists, but each is a separate decision; tackle one at a time.
- **No automatic re-routing of skipped sources to WavPack** (the spiritual "right" target for 32-bit-float audio). The skip is informational only — the user decides what to do with float sources per album, which is the stated workflow. A future "Convert Lossless Audio to WavPack" command would be its own worker.
- **No widening of the extension allowlist** to include `.dsf` / `.dff`. Today they're rejected by `filterIsLosslessAudioFile` before any probe runs; this worker doesn't change that. The `dsd` skip reason exists for defense-in-depth if the extension allowlist ever grows.
- **No `unreadable` skip reason** unless the `getIsLosslessFlacCompatible` helper genuinely needs to swallow probe failures. Prefer letting `getMediaInfo` failures propagate as pipeline errors (existing behavior) — that's a louder signal than a silent skip.
- **No FLAC 1.4+ 32-bit-integer-PCM verification.** Most ffmpeg builds support it; this worker assumes any non-float integer PCM that survives the probe is encodable, and leans on the existing lossless-flags-only encode args. A separate worker can add explicit 32-bit-int round-trip verification if a real-world counterexample appears.
