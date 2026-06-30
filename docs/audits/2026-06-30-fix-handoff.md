# 2026-06-30 — Fix handoff: TODO items that don't match decisions or v1.0.0

A consolidated, prioritized work list for another agent. Every item here was surfaced by the 2026-06-29/30 audits and is **not yet fixed** (worker 7d is the one already filed). Each item cites the source audit for full evidence. Follow [AGENTS.md](../../AGENTS.md), the [decision log](../decisions/README.md), and the testing rules; a new command surface must land on [all five wiring surfaces](../decisions/2026-05-14-new-command-needs-five-wiring-surfaces.md).

Sources: [v1.0.0 parity delta](2026-06-29-v1.0.0-parity-delta.md), [decisions-vs-implementation](2026-06-29-decisions-vs-implementation.md).

---

## P0 — data integrity / blocking

### A. `LookupVariantStage` writes an object into the numeric `dvdCompareId` field
- **Problem:** `packages/web/src/components/LookupVariantStage/LookupVariantStage.tsx:74-80` does `setParam(stepId, fieldName, { hash, label })` — stuffing an object into a numeric id field (the `[object Object]` hazard `LookupReleaseStage` explicitly warns against). Latent today (only reachable once item C restores the stage) but fix now so it isn't a landmine.
- **Fix:** mirror `LookupReleaseStage`'s four-scalar write (`dvdCompareReleaseHash` + label + companion name + fid). Never write an object into the id field.
- **Acceptance:** unit test asserting the four scalars are written and no object reaches `dvdCompareId`.

### B. `flattenOutput` does copy+delete instead of a filesystem move
- **Already filed as [worker 7d](../workers/7d_filesystem-move-not-copy-delete.md).** Governed by [atomic copy + filesystem move](../decisions/2026-05-19-atomic-copy-and-filesystem-move.md). Same-volume moves must be `fs.rename` (no temp). Extract one shared `moveSingleFile` primitive and audit every move-semantic command.

---

## P1 — user-facing regressions (medium)

### C. Restore the multi-variant disc-type picker stage (DVD vs Blu-ray vs 4K)
- v1 presented a pick stage when a title had >1 disc format and the format filter was "All"; React auto-picks `variants[0]` and `LookupVariantStage` is dead code. (delta #4)
- **Fix:** when `formatFilter === "all"` and a group has >1 variant, transition to the variant stage instead of auto-selecting. Pairs with item A.
- Files: `packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx:398-428`, `LookupVariantStage`.

### D. Name Special Features results affordances (Play / Browse / lookup link)
- Lost from v1's results panel: ▶ Play preview on each leftover/unnamed file row (delta #9), 📁 Browse-files button scoped to the source folder (#10), ↗ DVD-Compare/lookup link in the results header (#11).
- Files: `packages/web/src/components/NsfRunResults/NsfRunResults.tsx` (vs v1 `public/builder/js/run-sequence/step-results.js`). Reuse `videoPreviewModalAtom` for Play, the file-explorer modal for Browse.

### E. Lookup search-result badges
- Per-provider metadata badges (MAL air-date/type, AniDB type/episode-count, TVDB year/status) (delta #1) and DVD-Compare group disc-type badges (DVD/Blu-ray/UHD) (#3). Formatter `formatDvdCompareDisplayName.ts` already exists, just unrendered.
- Files: `packages/web/src/components/LookupSearchStage/LookupSearchStage.tsx:380-428`.

### F. File-explorer manual Refresh
- No way to re-fetch the current directory listing (delta #16). Add a refresh button in the modal title bar calling the existing list loader for `currentPath`.
- File: `packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx`.

### G. Surface Name Special Features server options in the builder UI
- `moveToEditionFolders` and `nonInteractive` exist server-side (`packages/api/src/api/schemas.ts:1285-1296`) but have **no builder field** — reachable only via hand-authored YAML / direct API. Add the fields (web command definition + labels), no server change needed.

---

## P2 — low severity (batch into one "lookup/results affordance restoration" worker)

- **H. Lookup row details:** `#<id>` per search row (delta #2); "Open film page ↗" + Film-ID header in the release picker (#6); "No release packages found" debug panel from the still-present `releasesDebug` atom (#7); `#<hash>` per release row (#8). Files under `LookupSearchStage.tsx` / `LookupReleaseStage.tsx`.
- **I. Generic results panel:** 📋 Copy button on the per-step Results `<details>` (delta #12); `getAudioOffsets` row label fallback to source basename when destination path absent (#13, `formatGenericResults.ts:24-34`).
- **J. Prompt modal:** bind `-` (and Escape) to submit the explicit `-2` cancel option (delta #14, `PromptModal.tsx`).
- **K. TheMovieDB card link:** restore the `searchTerm` fallback + pending-state branch dropped from the "Open on TheMovieDB" link (delta #15, `NumberWithLookupField.tsx:342`).
- **L. Experimental transcoded audio:** port v1's seekable MSE player into the transcode branch, OR formally retire the default-off `EXPERIMENTAL_FFMPEG_TRANSCODING` flag (delta #17, `FileVideoPlayer.tsx`).

---

## Cleanup / verify

- **M.** `packages/web/src/components/GenericRunResults/GenericRunResults.tsx:16` still lists the bare legacy command name `nameSpecialFeatures`. Verify this is intentional (matching old job records) and not a dead reference that should be the renamed `nameSpecialFeaturesDvdCompareTmdb`. Governed by [the rename + legacy-shim decision](../decisions/2026-05-14-name-special-features-rename-and-legacy-shim.md).

## Already correct — do NOT "fix"

- The legacy `nameSpecialFeatures` / `mergeTracks` names load via silent shim and are correctly **absent from the command picker**. That is the intended deprecated-but-loadable contract — leave it.
- `moveFiles`, `moveFilesIntoNamedFolders`, `flattenChildFolders`, Name Special Features bucket moves already use `fs.rename` correctly.
- The intentional non-regressions listed at the bottom of the [v1.0.0 delta](2026-06-29-v1.0.0-parity-delta.md) (delete-mode badge styling per worker 73, ms→s unit changes, field renames, etc.).
