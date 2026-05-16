# Worker 4e — detect-trailing-credit-chapters

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/4e-detect-trailing-credit-chapters`
**Worktree:** `.claude/worktrees/4e_detect-trailing-credit-chapters/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new **read-only/dry-run-first** app-command — `detectTrailingCreditChapters` — that scans a directory of MKV files (typically a TV series folder) for trailing chapters whose chapter names match a configurable credit-name pattern set (`Credits`, `End Credits`, `ED`, `Ending`, `Outro`, `Preview`, etc.). It emits a structured list of `{ filePath, flaggedChapterIndices, flaggedTimeRanges }` records so a downstream "trim chapter range" command can consume the output to actually remove or re-mux those tail segments. This worker does **not** modify any files — it is pure detection.

This is the read-side bookend of worker 4d (renumber chapters). Once a separate trim-range command lands, the two compose: `detectTrailingCreditChapters` → review/edit → trim → 4d renumber.

### Shape to mirror

[packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) is the canonical "scan and report, do not mutate" command in this repo. Keep the same overall structure: `getFilesAtDepth` → file-type filter → per-file inspection → tap/log → `logAndRethrowPipelineError`. The only difference is per-file inspection runs `getMkvInfo` instead of grouping by basename.

### Inputs

```ts
type DetectTrailingCreditChaptersProps = {
  isRecursive: boolean
  sourcePath: string
  // Configurable patterns (case-insensitive substring or anchored regex).
  // Defaults below ship as sensible-out-of-the-box for anime/TV series.
  creditNamePatterns?: string[]
  // Only flag chapters whose 1-based index falls within the trailing
  // window. Default `2` = "only the last two chapters are eligible".
  trailingWindow?: number
}
```

Defaults (export alongside the command, like `replaceFlacWithPcmAudioDefaultProps`):

```ts
export const detectTrailingCreditChaptersDefaultProps = {
  creditNamePatterns: [
    "credits",
    "end credits",
    "ed",
    "ending",
    "outro",
    "preview",
    "next episode",
  ],
  trailingWindow: 2,
} satisfies DetectTrailingCreditChaptersOptionalProps
```

### Detection algorithm

1. For each MKV under `sourcePath` (respecting `isRecursive` with depth 1 — match `fixIncorrectDefaultTracks`'s pattern), call `getMkvInfo` ([packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts)) and read its chapter list.
2. Pull the chapter names + start/end timecodes. `getMkvInfo` currently surfaces `chapters: Chapter[]` with `num_entries`; you will need to extend the existing call (or add a sibling reader) to surface per-chapter `{ name, startTime, endTime }`. **Reuse the existing `mkvmerge -J` invocation** — don't shell out a second time per file.
3. Within the trailing window (`chapters.length - trailingWindow` through end), test each chapter's name against the `creditNamePatterns` list case-insensitively.
4. Emit one record per file that has at least one match:
   ```ts
   {
     filePath: string
     flaggedChapterIndices: number[]  // 1-based
     flaggedTimeRanges: Array<{ startTime: string; endTime: string }>
   }
   ```
5. Files with no matches do not emit (mirrors `hasDuplicateMusicFiles` — silent when clean).
6. Wrap the pipeline with `logAndRethrowPipelineError(detectTrailingCreditChapters)` and a `tap` that `console.info`s a human-readable summary so the CLI/Builder log is grep-able.

### Wiring

The command needs surfaces in the same six places every other app-command lives:

1. **App-command:** [packages/server/src/app-commands/detectTrailingCreditChapters.ts](../../packages/server/src/app-commands/detectTrailingCreditChapters.ts) — new file.
2. **Schema:** add `detectTrailingCreditChaptersRequestSchema` to [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts). Fields: `sourcePath` (path), `isRecursive` (boolean), `creditNamePatterns` (string[] optional), `trailingWindow` (number ≥ 1 optional). Use `is`/`has` prefix discipline (eslint rule from worker 05).
3. **Route registration:** add the entry to [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) under the appropriate tag (likely `Analysis` — this is detection, not mutation).
4. **Web command list:** add to [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) `fieldBuilder(...)` block (alphabetical with siblings).
5. **Label:** add to [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display name `Detect Trailing Credit Chapters`.
6. **CLI wrapper:** [packages/cli/src/cli-commands/detectTrailingCreditChaptersCommand.ts](../../packages/cli/src/cli-commands/detectTrailingCreditChaptersCommand.ts) — mirror [hasDuplicateMusicFilesCommand.ts](../../packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts) (positional `sourcePath`, `-r`, optional `--credit-name-patterns` and `--trailing-window`). Register in the CLI's command index.

### Helper extraction (one-component-per-file discipline)

`getMkvInfo` currently returns chapter aggregates (`num_entries`) but not per-chapter names. Extend it (or add a sibling `getMkvChapters.ts`) such that callers can opt into the heavier chapter-name payload without paying for it on every consumer. Match the existing helper layout under [packages/server/src/tools/](../../packages/server/src/tools/).

If the regex builder for credit patterns gets larger than a few lines, extract a sibling `detectTrailingCreditChapters.patterns.ts` — dotted-suffix sibling, no barrel (see project memory).

### Fake-data scenario

Add [packages/server/src/fake-data/scenarios/detectTrailingCreditChapters.ts](../../packages/server/src/fake-data/scenarios/detectTrailingCreditChapters.ts) modelled on [replaceFlacWithPcmAudio.ts](../../packages/server/src/fake-data/scenarios/replaceFlacWithPcmAudio.ts) so dry-run mode produces deterministic output for e2e and screenshots. Register it in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts).

## TDD steps

1. **Failing unit test** — `detectTrailingCreditChapters.test.ts` next to the new app-command. Stub `getMkvInfo`/`getMkvChapters` with fixture chapter lists covering:
   - Clean file (no credit chapters) → no emission.
   - Series episode with a final "ED" chapter → one record, `flaggedChapterIndices: [N]`.
   - File with "Preview" in the middle (outside trailing window) → no emission.
   - Custom `creditNamePatterns: ["bonus"]` → flags a "Bonus" trailing chapter.
   - `trailingWindow: 1` clamps to only the last chapter.
2. **Failing schema test** — assert `detectTrailingCreditChaptersRequestSchema` rejects `trailingWindow: 0`, accepts defaults, and trims `sourcePath`.
3. **Failing route test** — POST to the new route with a fixture body and assert a 200 + structured response shape (use the harness existing route tests follow).
4. Implement until green. Two commits (red, then green) per the established convention.
5. **Parity fixture** — add `packages/web/tests/fixtures/parity/detectTrailingCreditChapters.input.json` + `.yaml` matching siblings under that folder, so the builder<->yaml round-trip test picks it up automatically.
6. **CLI smoke** — run the new CLI command against the fake-data scenario; assert it prints expected records.
7. Standard gate: `yarn lint → typecheck → test → e2e → lint`.

## Files

### New

- [packages/server/src/app-commands/detectTrailingCreditChapters.ts](../../packages/server/src/app-commands/detectTrailingCreditChapters.ts)
- [packages/server/src/app-commands/detectTrailingCreditChapters.test.ts](../../packages/server/src/app-commands/detectTrailingCreditChapters.test.ts)
- [packages/server/src/fake-data/scenarios/detectTrailingCreditChapters.ts](../../packages/server/src/fake-data/scenarios/detectTrailingCreditChapters.ts)
- [packages/cli/src/cli-commands/detectTrailingCreditChaptersCommand.ts](../../packages/cli/src/cli-commands/detectTrailingCreditChaptersCommand.ts)
- [packages/web/tests/fixtures/parity/detectTrailingCreditChapters.input.json](../../packages/web/tests/fixtures/parity/detectTrailingCreditChapters.input.json)
- [packages/web/tests/fixtures/parity/detectTrailingCreditChapters.yaml](../../packages/web/tests/fixtures/parity/detectTrailingCreditChapters.yaml)
- Optional: `packages/server/src/tools/getMkvChapters.ts` if extending `getMkvInfo` would balloon it

### Extend

- [packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts) — surface per-chapter `name`/`startTime`/`endTime` (only if not extracted to a sibling)
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `detectTrailingCreditChaptersRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — route registration
- [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) — scenario registration
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field builder
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- CLI command index (find via grep — wherever sibling CLI commands are registered)

### Reuse — do not reinvent

- [hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) — overall pipeline shape (scan, report, no mutation, `logAndRethrowPipelineError`).
- [getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts) — MKV introspection; do not invent a second `mkvmerge -J` caller.
- [filterIsVideoFile.ts](../../packages/server/src/tools/filterIsVideoFile.ts) — already filters to video extensions.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/4e_detect-trailing-credit-chapters/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commit precedes green-implementation commit
- [ ] Command never modifies files on disk (verify by code review — no `runMkvPropEdit`/`runMkvMerge`/`runFfmpeg` imports)
- [ ] One component per file; sibling files via dotted-suffix; no barrel for a single split
- [ ] `creditNamePatterns` default list is exported and consumed by both the server default and the CLI default
- [ ] Parity fixture round-trips
- [ ] Fake-data scenario registered and exercised by e2e
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Actually trimming or re-muxing** the flagged chapter ranges. A separate worker introduces the trim-range command; this one only detects.
- **Renumbering chapters** after trim — that's worker 4d.
- **Generalizing the credit detector to non-trailing positions.** Mid-file ad-break or recap detection is a separate problem with a different heuristic.
- **TMDB or AniDB-backed credit identification.** Patterns are local-only; no external API calls.
