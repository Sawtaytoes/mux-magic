# Worker 4e — detect-trailing-content-outliers

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/4e-detect-trailing-content-outliers`
**Worktree:** `.claude/worktrees/4e_detect-trailing-content-outliers/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

> **Naming note.** This worker's command was originally drafted as `detectTrailingCreditChapters` (chapter-name match against `Credits`/`ED`/`Outro`/...). That approach has been replaced with cohort-relative outlier detection, so the command name moves to `detectTrailingContentOutliers`. The doc filename keeps its `4e_…` prefix for manifest stability; if you want to rename the doc + branch as well, do it in the same `chore(manifest)` commit that flips this row to `in-progress`.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new **read-only / dry-run-first** app-command — `detectTrailingContentOutliers` — that scans a directory of MKV files (typically a TV-season folder), groups them into sibling clusters by filename prefix, and reports any file whose tail differs from the cohort by enough to warrant manual review. The motivating case: when episodes are ripped off a disc as one big M2TS and split, the disc's *last* episode sometimes carries an anti-piracy / licensing / studio-tag image after the credits. Within a season, those extra-tail files stand out as duration or chapter-shape outliers relative to their peers.

This worker does **not** modify any files — it is pure detection. A downstream "trim chapter range" command (separate worker) consumes its output.

This is the read-side bookend of worker 4d (renumber chapters). Once a trim-range command lands, the three compose: `detectTrailingContentOutliers` → review/edit → trim → 4d renumber.

### Explicitly NOT in scope

- **English-dub trailing credits in sub-only setups.** Japanese and English credits typically share the same chapter, and there's no clean structural signal at this level. A future worker may try audio-track silence analysis; this one will not.
- **Mid-file or recap detection.** Only trailing-region anomalies.
- **Actually trimming** the flagged ranges. Separate worker.
- **TMDB/AniDB or external metadata.** Local-only heuristics.

### Shape to mirror

[packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) is the canonical "group siblings → compute cohort signal → emit only the anomalies" command in this repo. Mirror its overall layout: directory enumeration → grouping → per-group analysis → tap/log → `logAndRethrowPipelineError`. The per-group analysis is where this worker diverges — it computes cohort statistics from `getMkvInfo` rather than comparing basenames.

### Inputs

```ts
type DetectTrailingContentOutliersProps = {
  isRecursive: boolean
  sourcePath: string
  // Files within `durationOutlierSeconds` of the cohort median duration
  // are considered "in family." Anime episodes are near-frame-identical
  // within a season, so the default is tight.
  durationOutlierSeconds?: number
  // Skip cohorts smaller than this. Below ~3 the median is meaningless
  // and false positives dominate.
  minClusterSize?: number
}
```

Defaults (export alongside the command, like `replaceFlacWithPcmAudioDefaultProps`):

```ts
export const detectTrailingContentOutliersDefaultProps = {
  durationOutlierSeconds: 2,
  minClusterSize: 3,
} satisfies DetectTrailingContentOutliersOptionalProps
```

### Detection algorithm

1. Enumerate MKVs under `sourcePath` (depth 1 unless `isRecursive`, matching `fixIncorrectDefaultTracks`'s pattern).
2. **Cluster** files by filename-prefix stem — strip a trailing episode-number token (e.g. `Show Name S01E07.mkv` → stem `Show Name S01`). Multiple seasons or extras in the same folder produce separate cohorts. If the prefix-stripping heuristic doesn't land cleanly, extract the stem-derivation into a sibling `detectTrailingContentOutliers.cluster.ts` (dotted-suffix, no barrel).
3. For each cohort with `< minClusterSize` members: emit an `console.info` line (`"cohort '<stem>': only N files, skipping"`) and continue. No records emitted for these.
4. For each qualifying cohort, call `getMkvInfo` once per file, surfacing **duration** plus per-chapter `{ name, startTime, endTime }`. Reuse the existing `mkvmerge -J` invocation — do not shell out twice. If extending `getMkvInfo` would balloon it, add a sibling `getMkvChapters.ts` under [packages/server/src/tools/](../../packages/server/src/tools/).
5. Compute cohort medians: `medianDurationSec`, `medianChapterCount`, `medianLastChapterDurationSec`.
6. For each file, evaluate three independent signals:
   - **`duration-outlier`** — `|file.durationSec - medianDurationSec| > durationOutlierSeconds`.
   - **`extra-trailing-chapter`** — `file.chapterCount > medianChapterCount` (only flag positive deviations; fewer chapters is the season-finale-no-preview case, not a stinger).
   - **`trailing-segment-outlier`** — `|file.lastChapterDurationSec - medianLastChapterDurationSec| > durationOutlierSeconds`, but only when chapter counts match (otherwise `extra-trailing-chapter` already covers it).
7. Files with at least one firing signal emit a record:

   ```ts
   {
     filePath: string
     cohortStem: string
     cohortSize: number
     isLastInCluster: boolean   // lexicographically last file in the cohort
     reasons: Array<
       | { kind: "duration-outlier"; fileDurationSec: number; cohortMedianSec: number; deltaSec: number }
       | { kind: "extra-trailing-chapter"; fileChapterCount: number; cohortMedianChapterCount: number; extraChapterStartTime: string }
       | { kind: "trailing-segment-outlier"; fileLastChapterDurationSec: number; cohortMedianLastChapterDurationSec: number; deltaSec: number }
     >
     suggestedTrimAt: { kind: "timecode"; value: string } | { kind: "seconds"; value: number }
   }
   ```

   - `suggestedTrimAt` prefers the chapter-derived timecode when `extra-trailing-chapter` fires (use the extra chapter's `startTime`); otherwise falls back to `{ kind: "seconds", value: medianDurationSec }`.
   - `isLastInCluster` is informational: a reviewer should treat a flagged last-in-cluster file as *probably the season finale*, not a stinger. The command does not suppress these — that judgment stays with the human.
8. Files with no firing signal do not emit. Mirrors `hasDuplicateMusicFiles` — silent when clean.
9. Wrap with `logAndRethrowPipelineError(detectTrailingContentOutliers)` and a `tap` that `console.info`s a human-readable per-cohort summary (`"cohort '<stem>': N files, M flagged"`) so the CLI/Builder log is grep-able.

### Wiring

The command needs surfaces in the same six places every other app-command lives:

1. **App-command:** [packages/server/src/app-commands/detectTrailingContentOutliers.ts](../../packages/server/src/app-commands/detectTrailingContentOutliers.ts) — new file.
2. **Schema:** add `detectTrailingContentOutliersRequestSchema` to [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts). Fields: `sourcePath` (path), `isRecursive` (boolean), `durationOutlierSeconds` (number > 0 optional), `minClusterSize` (integer ≥ 2 optional). Use `is`/`has` prefix discipline (eslint rule from worker 05).
3. **Route registration:** add the entry to [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) under the appropriate tag (likely `Analysis` — this is detection, not mutation).
4. **Web command list:** add to [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) `fieldBuilder(...)` block (alphabetical with siblings).
5. **Label:** add to [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display name `Detect Trailing Content Outliers`.
6. **CLI wrapper:** [packages/cli/src/cli-commands/detectTrailingContentOutliersCommand.ts](../../packages/cli/src/cli-commands/detectTrailingContentOutliersCommand.ts) — mirror [hasDuplicateMusicFilesCommand.ts](../../packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts) (positional `sourcePath`, `-r`, optional `--duration-outlier-seconds` and `--min-cluster-size`). Register in the CLI's command index.

### Helper extraction (one-component-per-file discipline)

`getMkvInfo` currently returns chapter aggregates (`num_entries`) but not per-chapter names/timecodes. Extend it (or add a sibling `getMkvChapters.ts`) so callers can opt into the heavier per-chapter payload without paying for it on every consumer. Match the existing helper layout under [packages/server/src/tools/](../../packages/server/src/tools/).

If the cohort-clustering / median-statistics logic grows past a few lines, extract sibling `detectTrailingContentOutliers.cluster.ts` and `detectTrailingContentOutliers.stats.ts` — dotted-suffix siblings, no barrel (see project memory).

### Fake-data scenario

Add [packages/server/src/fake-data/scenarios/detectTrailingContentOutliers.ts](../../packages/server/src/fake-data/scenarios/detectTrailingContentOutliers.ts) modelled on [replaceFlacWithPcmAudio.ts](../../packages/server/src/fake-data/scenarios/replaceFlacWithPcmAudio.ts). Cover:

- A 12-file season where file 7 is ~30s longer (disc-end stinger). Expect one record with `duration-outlier` reason.
- The same season where file 12 (the finale) is 90s longer but has no extra chapter. Expect one record, `isLastInCluster: true`.
- A folder with two stems (`Show A S01E*`, `Show B S01E*`) so cohort splitting is exercised.
- A folder with only two files in a stem — expect skip-with-info-log, no emission.

Register the scenario in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts).

## TDD steps

1. **Failing unit test** — `detectTrailingContentOutliers.test.ts` next to the new app-command. Stub `getMkvInfo`/`getMkvChapters` with fixture cohorts covering:
   - Clean cohort (all durations within tolerance) → no emission.
   - One file ~30s longer than peers → record with `duration-outlier`.
   - One file with an extra trailing chapter → record with `extra-trailing-chapter` and `suggestedTrimAt.kind === "timecode"`.
   - Last file in cohort flagged → `isLastInCluster: true`, record still emitted.
   - Cohort of 2 files → skipped, info log emitted.
   - Two cohorts in one folder → independent statistics per cohort.
2. **Failing schema test** — assert `detectTrailingContentOutliersRequestSchema` rejects `durationOutlierSeconds: 0`, rejects `minClusterSize: 1`, accepts defaults, and trims `sourcePath`.
3. **Failing route test** — POST to the new route with a fixture body and assert a 200 + structured response shape (mirror existing route tests' harness).
4. Implement until green. Two commits (red, then green) per the established convention.
5. **Parity fixture** — add `packages/web/tests/fixtures/parity/detectTrailingContentOutliers.input.json` + `.yaml` matching siblings under that folder, so the builder ↔ yaml round-trip test picks it up automatically.
6. **CLI smoke** — run the new CLI command against the fake-data scenario; assert it prints expected records.
7. Standard gate: `yarn lint → typecheck → test → e2e → lint`.

## Files

### New

- [packages/server/src/app-commands/detectTrailingContentOutliers.ts](../../packages/server/src/app-commands/detectTrailingContentOutliers.ts)
- [packages/server/src/app-commands/detectTrailingContentOutliers.test.ts](../../packages/server/src/app-commands/detectTrailingContentOutliers.test.ts)
- [packages/server/src/fake-data/scenarios/detectTrailingContentOutliers.ts](../../packages/server/src/fake-data/scenarios/detectTrailingContentOutliers.ts)
- [packages/cli/src/cli-commands/detectTrailingContentOutliersCommand.ts](../../packages/cli/src/cli-commands/detectTrailingContentOutliersCommand.ts)
- [packages/web/tests/fixtures/parity/detectTrailingContentOutliers.input.json](../../packages/web/tests/fixtures/parity/detectTrailingContentOutliers.input.json)
- [packages/web/tests/fixtures/parity/detectTrailingContentOutliers.yaml](../../packages/web/tests/fixtures/parity/detectTrailingContentOutliers.yaml)
- Optional siblings: `packages/server/src/tools/getMkvChapters.ts`, `detectTrailingContentOutliers.cluster.ts`, `detectTrailingContentOutliers.stats.ts` — only if the relevant section would balloon the main file

### Extend

- [packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts) — surface duration + per-chapter `name`/`startTime`/`endTime` (only if not extracted to a sibling)
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `detectTrailingContentOutliersRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — route registration
- [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) — scenario registration
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field builder
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- CLI command index (find via grep — wherever sibling CLI commands are registered)

### Reuse — do not reinvent

- [hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) — overall pipeline shape (group, report, no mutation, `logAndRethrowPipelineError`).
- [getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts) — MKV introspection; do not invent a second `mkvmerge -J` caller.
- [filterIsVideoFile.ts](../../packages/server/src/tools/filterIsVideoFile.ts) — already filters to video extensions.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/4e_detect-trailing-content-outliers/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commit precedes green-implementation commit
- [ ] Command never modifies files on disk (verify by code review — no `runMkvPropEdit`/`runMkvMerge`/`runFfmpeg` imports)
- [ ] One component per file; sibling files via dotted-suffix; no barrel for a single split
- [ ] Defaults (`durationOutlierSeconds: 2`, `minClusterSize: 3`) are exported and consumed by both the server default and the CLI default
- [ ] Cohorts below `minClusterSize` log an info line and emit nothing
- [ ] Parity fixture round-trips
- [ ] Fake-data scenario registered and exercised by e2e
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Trimming or re-muxing** the flagged ranges. A separate worker introduces the trim-range command; this one only detects.
- **Renumbering chapters** after trim — that's worker 4d.
- **English-dub trailing credits** in sub-only setups (chapter boundaries don't separate them from the Japanese credits; would need audio-track silence analysis). Revisit as a follow-up worker if a tractable signal emerges.
- **Chapter-name-based detection** (`"ED"`, `"Outro"`, `"Preview"` matching). The cohort-outlier approach subsumes the common case and avoids false negatives from idiosyncratic chapter labels. If a future workflow needs name-based filtering, layer it as a sibling command rather than retrofitting this one.
- **TMDB or AniDB-backed identification.** Local-only.
