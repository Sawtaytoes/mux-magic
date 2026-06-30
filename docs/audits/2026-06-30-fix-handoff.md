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

## Sweep delta — 2026-06-30 (behavioral / enforcement / CLI blind spots)

Three follow-up audits beyond the parity + decision passes. These check *behavior and enforcement*, not just presence.

### N. Plex `-<type>` suffix rule is only PARTIALLY enforced

Governed by [the suffix decision](../decisions/2026-06-30-special-features-always-get-plex-type-suffix.md). The automatic timecode-match path always appends a suffix, but four paths can produce a **suffix-less** name (the exact regression the decision exists to prevent):

> **STATUS — 2026-06-30 (addressed this session):** All four are resolved.
> Galleries `(N images)`/`(N pages)` → `-other` in core (commit `6331330a`).
> The Plex-type picker (N4) shipped as worker 7a (commit `2f9d22d6`), and the
> Smart Match modal now **blocks Apply** for any included row without a type —
> covering N1/N2/N3 at the point of the rename POST. **IMPORTANT correction to
> N1's recommendation:** per the decision, do NOT "default to `-other`" — that
> is explicitly rejected. The correct fix (now implemented) is to **require an
> explicit type pick and block** the rename until one is chosen. Galleries get
> `-other` only by *positive identification*, not as a fallback.

- **N1 (P0) — untyped-candidate bare fallthrough.** `applySpecialFeatureSuffix` returns bare `humanized` when type/parentType are unknown; that name feeds the Smart Match candidate. **Resolved** by the modal's require-type block (the bare candidate can't be Applied without a type pick) — NOT by defaulting `-other`. ✅
- **N2 (P0) — Smart Match custom-name (✏) accepts a bare name.** **Resolved:** `handleApply` blocks any included row whose Plex-type is "— no type —". ✅
- **N3 (P0) — Smart Match zero-candidate text box accepts a bare name.** **Resolved:** same `handleApply` block applies to all rows. ✅
- **N4 (P1) — the decision's required Plex-type picker UI is missing.** **Resolved:** `plexExtraTypes.ts` + per-row `<select>` shipped as worker 7a. ✅

### O. Behavioral command-parity drift (v1.0.0 → now)

- **O1 (P2) — CONFIRMED regression: `deleteFilesByExtension` default depth must be 2, not 1.** v1.0.0 defaulted to 2; the rewrite changed it to 1 (`deleteFilesByExtension.ts:38`) and updated its schema doc to match (`schemas.ts:639`), which made the regression *look* intentional. The user confirmed 2026-06-30 that 2 is correct — they point the command a level above the per-episode subtitle folders, so the `.srt` files sit two levels down and a depth-1 default silently leaves them. **Fix:** `recursiveDepth || 1` → `|| 2`; schema desc → "default depth of 2"; update the sibling schemas' "mirrors deleteFilesByExtension" wording (`schemas.ts:261, 361`). The *other* recursive commands stay at 1. Governed by [the decision](../decisions/2026-05-20-default-recursion-depth-is-1.md). (An earlier retraction of this finding was wrong — code + doc were changed to 1 together, fooling the cross-check.) **Open:** confirm whether `modifySubtitleMetadata`/`getSubtitleMetadata` also need 2.
- **O2 (P2, awareness) — `copyFiles` folder-copy branch ignores `allowOverwrite`.** The new `isIncludingFolders` path uses `fs.cp(..., { recursive: true })`, which clobbers via Node's `force:true` default regardless of `isOverwriteAllowed`. No v1 baseline (the option is new), so not strictly a regression, but it contradicts the refuse-overwrite-by-default rule in [atomic-copy](../decisions/2026-05-19-atomic-copy-and-filesystem-move.md). **Fix:** pass `{ force: isOverwriteAllowed }` / pre-check destinations.
- **O3 (P2) — `cleanupFilename` colon-space sanitization narrowed.** v1 replaced any `": "` with `" - "`; current only does so after a word character (`/(\w): /`), so a `": "` after `)`/`]`/space/string-start now falls through to the `:→-` rule with different spacing. Edge-case title text only — common `Word: ` titles are unaffected, and `SxxExx` padding/templates are verified intact. Evidence: `server-v1.0.0:src/tools/cleanupFilename.ts:5-8` vs `packages/tools/src/cleanupFilename.ts:4-5`. **Status (2026-06-30): PENDING user decision — do NOT "fix" yet.** The user recalls deliberately making the colon handling safer (~3 cases) so weird renames wouldn't happen; the `\w` guard is likely intentional. The only genuinely-open question is whether the punctuation-before-colon case (e.g. `Episode (Part 1): The End` → `…(Part 1)- The End`, no leading space) is acceptable or a small gap. Resolve, then either record a decision (intentional) or fix just that case.
- **Track-operation parity: CLEAN.** No drift in the muxing path — track order, default/forced flags, language tagging, and sync offsets all match v1.0.0 (every difference is a documented intentional change, e.g. BCP-47 `ietf`, `hasChapterSyncOffset`→`hasAudioSyncOffset`).
- **Naming parity: CLEAN apart from O3.** Rename templates, zero-padding, `(N)`/`(2)(3)` disambiguation counters, edition tags, suffix vocabulary, and sort/tie-break order are all byte-equivalent ports. (`nameMovieCutsDvdCompareTmdb` is a new command with no v1 baseline.)
- **Subtitle / timecode parity: CLEAN** (full pass complete). Timecode units (ms throughout), ASS centisecond/ms serialization, offset sign/units, ASS rule order (`[...defaults, ...userRules]`), default-rule margin math, and ISO-639 language mapping all match v1.0.0. The one intentional behavior change here is the `extractSubtitles` image-codec gating (worker 3b removed the hardcoded skip). The depth `2 → 1` default is a *separate, confirmed regression* for `deleteFilesByExtension` (see O1) — not part of the clean subtitle/timecode result.

### P. Command-line parity gaps

Governed by [five-surfaces](../decisions/2026-05-14-new-command-needs-five-wiring-surfaces.md). No v1.0.0 CLI command was lost (current CLI is a superset). Gaps:

- **P-1 / P-2 — NOT gaps (confirmed by the user 2026-06-30).** `makeDirectory` is a trivial recursive `mkdir` with no business logic — not worth a CLI command (script `mkdir -p` directly). `exitIfEmpty` is a sequence-flow gate (one-shot "is this folder empty → stop the sequence") that is meaningless outside a sequence. Both are intentionally **sequence/UI-only**; this is a legitimate exception to the five-surfaces rule for flow-control and trivial-shell commands. Do not add CLI commands for them.
- **P-3 (P2) — regex `flags` not exposed on CLI** for `copyFiles`/`moveFiles`/`renameFiles` (API takes `{pattern, flags}`; CLI takes a bare string). Case-insensitive/multiline filtering is CLI-unreachable. Add `--fileFilterFlags`/`--folderFilterFlags` (validate `^[gimsuy]*$`).
- **P-4 (P2) — multi-rule `renameRegex` array not exposed on CLI** (only a single `--renamePattern`/`--renameReplacement`). Add repeatable/JSON input or document the single-rule limit.
- **P-5 (P2) — `extractSubtitles --folders` missing** (API `schemas.ts:311`). Add the option and forward it.
- **P-6 (P2) — `autoNameDuplicates` default drift:** CLI defaults `true`, web/API default `false`. Align (or document the CLI-non-interactive default).
- **P-7 (P2) — `nameSpecialFeaturesDvdCompareTmdb` / `nameMovieCutsDvdCompareTmdb` don't expose `--dvdCompareId` / `--dvdCompareReleaseHash` / `--searchTerm`** (the `onlyName...` sibling does). Make `url` optional and add them for parity.
- **Reverse asymmetry (verify intentional):** `inverseTelecineDiscRips`, `mergeOrderedChapters`, `getSubtitleMetadata` are CLI-only / absent from the web picker (`getSubtitleMetadata` has an API schema but no web entry).

---

## Deferred follow-ups

### Q. Smart Match: name a leftover as the feature film / a cut (the suffix-less exception)

Governed by [the suffix decision](../decisions/2026-06-30-special-features-always-get-plex-type-suffix.md) ("Deferred — the film/cut exception"). The decision makes a `-<type>` suffix mandatory for every special feature; the **only** legitimately suffix-less names are the feature film (`Title (Year)`) and its cuts/editions (`{edition-…}`). The Smart Match modal has **no** way to mark a leftover as the film or a cut, so today such a file simply **can't be named there** — the require-type block leaves it in `UNNAMED-FEATURES/` (acceptable interim behavior; this flow is for special features, not the movie itself).

- **Open design** (user has no preferred shape yet): how should "this leftover is actually the film / a cut" surface — a special option in the type picker? a separate control? does the cut need an `{edition-…}` tag, and where does the edition name come from?
- **Possible overlap:** a separate movie-/cut-naming task may already exist (the core run already does film/cut naming via `postProcessMatches` / `findMatchingCut`); check before building new UI. It may be enough to route the file back to `sourcePath` for the existing pipeline rather than name it in Smart Match.
- **Until built:** leave un-typeable / film / cut files unnamed in the bucket. Do NOT auto-name them.

## Cleanup / verify

- **M.** `packages/web/src/components/GenericRunResults/GenericRunResults.tsx:16` still lists the bare legacy command name `nameSpecialFeatures`. Verify this is intentional (matching old job records) and not a dead reference that should be the renamed `nameSpecialFeaturesDvdCompareTmdb`. Governed by [the rename + legacy-shim decision](../decisions/2026-05-14-name-special-features-rename-and-legacy-shim.md).

## Already correct — do NOT "fix"

- The legacy `nameSpecialFeatures` / `mergeTracks` names load via silent shim and are correctly **absent from the command picker**. That is the intended deprecated-but-loadable contract — leave it.
- `moveFiles`, `moveFilesIntoNamedFolders`, `flattenChildFolders`, Name Special Features bucket moves already use `fs.rename` correctly.
- The intentional non-regressions listed at the bottom of the [v1.0.0 delta](2026-06-29-v1.0.0-parity-delta.md) (delete-mode badge styling per worker 73, ms→s unit changes, field renames, etc.).
- **Default recursion depth of 1** is intended for `convertLosslessToFlac` / `modifySubtitleMetadata` / `getSubtitleMetadata` — do NOT blanket-restore depth 2 for *those* from a v1 diff. (Exception: `deleteFilesByExtension` must be **2** — that's the O1 fix, not a do-not-touch.) See [the decision](../decisions/2026-05-20-default-recursion-depth-is-1.md).
- **Track-operation, naming, and subtitle/timecode behavioral parity** were all verified against v1.0.0 and are clean (only the low/med `cleanupFilename` edge case is open, O3). Don't re-port muxing/naming logic against the v1 tree.
