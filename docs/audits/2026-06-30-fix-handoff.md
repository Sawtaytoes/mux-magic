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

### R. Lookup-backed variable cards have no search button
- **Problem (user-reported 2026-06-30):** a `dvdCompareId` variable card renders only a value input — there's no way to *look up* the id from the card. The user has to open a Name Special Features step, use its search button, then rely on the link-back. Same gap for the other lookup-backed types (`tmdbId` / `anidbId` / `malId`).
- The `path` variable card already has a 📁 browse button in its header (`VariableCard.tsx:102-120`) that opens the file explorer and writes the pick back via `setValue`. Lookup-backed types should get an equivalent 🔍 **search** button that opens the lookup modal for the type's provider and writes the chosen id to the variable value.
- The type defs already declare what's needed (`packages/web/src/state/variableTypes/*.ts`): `isLinkable: true`, `runtimeValueType: "number"`, and the `type` maps to a provider — `dvdCompareId`→DVD Compare, `tmdbId`→TheMovieDB, `anidbId`→AniDB, `malId`→MAL.
- **Fix:** in `VariableCard.tsx`, add a header search button for the lookup-backed types (mirror the `path` 📁 dispatch). Reuse the lookup-open logic from `NumberWithLookupField.tsx` (the command-field version that already maps type → lookup provider and opens the modal); on select, call `setValue({ variableId: variable.id, value })`.
- Files: `VariableCard.tsx`, the per-type input components (`DvdCompareIdInput` etc.), `NumberWithLookupField.tsx` (reference).

### S. Cross-populate linked ID variables on lookup (one-directional, where a mapping exists)
- **Idea (user 2026-06-30):** when you look up / set one ID variable and another ID can be **derived** from it, auto-populate the linked variable instead of making the user look it up separately. Concretely: a `dvdCompareId` already resolves to a title + year, and `resolveTmdbForBaseTitle` (`runReverseLookup.ts:126-161`) already turns that into `{ tmdbId, tmdbName }` — this is exactly what powers the "Open on TheMovieDB" link on the DVD Compare field. So if a `tmdbId` variable is linked, set its value from the derived id automatically.
- **Direction matters:** `dvdCompareId → tmdbId` works (DVD Compare → name → TheMovieDB search). The reverse (`tmdbId → dvdCompareId`) does **not** — there is no TheMovieDB→DVD Compare mapping. Only populate in the direction a derivation exists.
- **Don't clobber:** only fill a linked variable that's empty (or confirm before overwriting a value the user set by hand).
- **Prior art:** worker 35 (DVD Compare reverse-lookup), worker 45 (field→variable link-awareness / write-through). This extends "a field writes to its own variable" into "one variable derives another."
- Files: `runReverseLookup.ts` (`resolveTmdbForBaseTitle`), `NumberWithLookupField.tsx`, `VariableCard.tsx` (compose with item R's search button), `variablesAtom` (`setVariableValueAtom`). Pairs naturally with item R.

### T. Cache DVD Compare data so lookups survive the site going offline
- **Problem (user 2026-06-30):** dvdcompare.net frequently goes offline. While it's down, every flow that scrapes it — Name Special Features, movie cuts, the cuts/censorship detection (worker 52) — fails. The user wants a cache to fall back on.
- **Goal:** cache DVD Compare scrape results so lookups still work (or degrade gracefully) when the site is unreachable.
- **Where:** wrap the fetches in `packages/core/src/tools/searchDvdCompare.ts` (search) plus the film-page / release-list / special-features fetchers with a disk-backed cache keyed by the request (DVD Compare id / release hash / URL).
- **Strategy:** network-first, fall back to cache on any fetch failure (DNS error, timeout, non-2xx). Optionally cache-first, since DVD Compare data is essentially static per release. Persist the parsed result (or the raw HTML) under a cache dir (e.g. `<userData>/mux-magic/dvdcompare-cache/`) keyed by a stable hash of the request; long TTL + a manual clear.
- **Surface it:** when serving from cache *because the site is down*, emit a clear "DVD Compare offline — using cached data (fetched `<date>`)" log/notice so the user knows the result may be stale.
- **Not a conflict with worker 25:** the "filesystem is the cache, no JSON metadata" decision ([nsf-filesystem-is-the-state](../decisions/2026-05-19-nsf-filesystem-is-the-state.md)) is about local file-naming *state* — an HTTP scrape-response cache is a separate, legitimate concern.
- **Tests:** worker 52 already calls for DVD Compare HTML fixtures (scrapers are brittle) — reuse them; add a test where `fetch` throws / returns 503 and the cache is served.
- Files: `packages/core/src/tools/searchDvdCompare.ts`, the release / special-features fetchers, plus a new cache helper (core or `@mux-magic/tools`).

### U. Derive the movie title from the lookup and make it a usable (folder-name) value
- **Idea (user 2026-06-30):** the DVD Compare → TheMovieDB resolution already grabs the **title**, not just the id — `resolveTmdbForBaseTitle` (`runReverseLookup.ts:126-161`) returns `{ tmdbId, tmdbName }`, where `tmdbName` is e.g. `Muppets Most Wanted (2014)`. Expose that resolved title as a **linkable value** (a `title` / `movieTitle` variable, or a named lookup output) so it can be dropped into a `copyFiles` / `moveFiles` destination as the folder name. Same one-way derivation as item S: `dvdCompareId → tmdbId → title`.
- If the title is linked straight into a step field, the existing field-link machinery may be enough. If it needs to live *inside* another variable (e.g. a path), it depends on **item V**.
- Files: `runReverseLookup.ts` (already returns the name), the variable registry, copy/move destination fields.

### V. Variable composition — let a variable reference other variables
- **Gap (user 2026-06-30, "should've been documented"):** variables hold literal values; one variable can't reference another. The user wants e.g. a path variable `<library>/${movieTitle}` that composes the derived title (item U) into a folder path. "Something we don't have yet."
- Today's resolution (`packages/api/src/api/resolveSequenceParams.ts`) handles `@pathId` links, `{linkedTo}` step outputs, and `${...}` substring interpolation — but all of those run on **step params at run time**, not on **variable values**. A variable's value is a literal, not a template.
- **Idea:** allow a variable value to interpolate other variables (`${otherLabel}` / `@id`), resolved when the variable is consumed. Guard against reference cycles and define resolution order. This unlocks "title → folder name" (U) and any composed path.
- Closest existing machinery: worker 6d (`forEachTemplate`'s `${binding}` substring interpolation in child-step params) — the syntax exists for loop bindings; this extends the concept to variable-defines-variable.
- Files: `resolveSequenceParams.ts`, the variables resolution path, `variablesAtom`.

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
- **O3 (P2) — `cleanupFilename` colon-space sanitization narrowed.** v1 replaced any `": "` with `" - "`; current only does so after a word character (`/(\w): /`), so a `": "` after `)`/`]`/space/string-start now falls through to the `:→-` rule with different spacing. Edge-case title text only — common `Word: ` titles are unaffected, and `SxxExx` padding/templates are verified intact. Evidence: `server-v1.0.0:src/tools/cleanupFilename.ts:5-8` vs `packages/tools/src/cleanupFilename.ts:4-5`. **Status (2026-06-30): CONFIRMED fix (P2).** The user wants v1.0.0 behavior — a colon-*space* must become `" - "` even after `)`/`]`/etc. **Fix:** revert rule 1 to the blanket `/: /g → " - "` (drop the `/(\w): /` guard); rule 2 `/:/g → "-"` still handles colon-without-space (`4:3` → `4-3`). One-line change in `cleanupFilename.ts`, but it runs through TV/anime/movie naming — add a test for the `Episode (Part 1): The End` → `Episode (Part 1) - The End` case. Governed by [the decision](../decisions/2026-06-30-cleanup-filename-colon-to-dash.md).
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
