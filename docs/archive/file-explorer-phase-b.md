# File-explorer Phase B — interactive renaming, searchable suggestions, duplicate-detection prompts

Tracking doc for the queued follow-ups to PR #15 (file-explorer modal) and
the in-flight PR for Phase A (prompt-modal Play button, path-field Browse,
picker mode). Phase B picks up the three remaining items from the user's
six-request batch on 2026-05-07; Phase A covers items #1, #2 (the play
button), #6 (Browse + picker).

## Goals

Three loosely-coupled features. They can ship as one PR or be split further
depending on review appetite when the time comes.

### 1. Interactive renaming on the `nameSpecialFeatures` result card  (req #3)

After an auto-naming run leaves files in the "Files not renamed (review by
hand)" callout, the user wants to fix those files in place — pick a name
for each unrenamed file, click "Rename," and see the row disappear from the
unrenamed list.

**UI** — replace the static `<li>` rows in `renderNameSpecialFeaturesResultsHtml`
([public/api/builder/index.html:4742-4794](public/api/builder/index.html#L4742-L4794))
with interactive rows. Each row gets:
- The current filename (read-only display)
- An input field with autocomplete (see #2 below)
- A "Rename" button

**Server** — new `POST /files/rename` endpoint mirroring the path-safety
guards from `DELETE /files`:
- Validate both `oldPath` and `newPath` via
  [`validateReadablePath`](src/tools/pathSafety.ts) — absolute, no `..`
  traversal.
- Reuse the existing
  [`renameFileOrFolder`](src/tools/createRenameFileOrFolder.ts) (which
  already checks for existing-target collision before renaming).
- Return the new path on success so the UI can update the row to reflect it.

**Refresh strategy** — no job-results store today. The renderer reads from
`step.results` populated by `waitForJob` ([index.html:2772](public/api/builder/index.html#L2772)).
On rename success, mutate `summaryRecord.unrenamedFilenames` to drop the
renamed entry and call the renderer again. No round-trip to refetch.

**Reuses:**
- `getLinkedValue(step, 'sourcePath')` at [index.html:1257](public/api/builder/index.html#L1257)
  — gives the absolute folder path so we know where to rename.
- `validateReadablePath` for path safety.
- `renameFileOrFolder` for the actual fs op.

### 2. Searchable suggestion list  (req #5)

When picking a name in the interactive renamer, the user wants a fuzzy
autocomplete pulling from the full set of valid names — not just the
`possibleNames` (untimed entries). Currently `possibleNames` is a small
list (image galleries, untimed cuts); the user also wants to manually
match against extras that DID have timecodes but for some reason didn't
auto-match this run.

**Data source** — extend the trailing summary record to carry the full
extras + cuts derived from the run. Today it's:
```ts
{ unrenamedFilenames: string[], possibleNames: string[] }
```
Phase B adds:
```ts
{
  unrenamedFilenames: string[],
  possibleNames: string[],
  // every parsed extras label (timecoded + untimed) and cut name from
  // the DVDCompare release, in DVDCompare-order. Pre-computed so the
  // UI doesn't need to re-parse anything client-side.
  allKnownNames: string[],
}
```
[`parseSpecialFeatures`](src/tools/parseSpecialFeatures.ts) already produces
both `extras` (with timecode) and `cuts`; we'd just flatten their text
into one ordered string array.

**UI** — input field with a dropdown of `allKnownNames`, filtered as the
user types. Match-sort by character occurrence (the codebase already has
`match-sorter` per `package.json`). When a match is picked, the input
fills with that label.

The existing `possibleNames` list can be a header in the dropdown ("Untimed
suggestions") to keep it visually weighted higher.

### 3. Duplicate-detection prompt enhancement  (req #4 + queue from PR #12)

Today, when two files match the same target name in one run, the within-run
scan in [nameSpecialFeatures.ts:407-431](src/app-commands/nameSpecialFeatures.ts#L407-L431)
applies `(2) NAME / (3) NAME` prefixes deterministically. The user wants
the option to be prompted instead: "these N files all match `<target>` —
which is which?"

**New schema field** — `autoNameDuplicates: boolean`:
- Default `false` in the Builder UI (interactive picker is the default UX).
- Default `true` for sequence / API runs where there's no human in the loop.
- Documented in the YAML so non-interactive runs can set it explicitly.

**New prompt shape** — multi-select prompt where each option is one of the
ambiguous files, plus the new ▶ Play button (already in Phase A). User
ticks one option per call (the matcher's existing single-pick semantics)
or, in a future revision, multiple to apply `(2)/(3)` to a subset.

**Existing primitives** — `getUserSearchInput` ([src/tools/getUserSearchInput.ts](src/tools/getUserSearchInput.ts))
already drives prompts; Phase A added `filePath` to the payload, which
naturally extends to the duplicate-pick case (the prompt is "about" all the
files, so the payload can carry an array).

This work also closes the EEXIST-on-rename-conflict edge case from PR #12 —
when a file's target conflicts with an existing on-disk file (not in the
batch), the (2)/(3) fallback applies regardless of `autoNameDuplicates`.

## Scope tradeoffs to revisit when starting

- Should "Rename" be one-at-a-time (immediate POST per click) or batch
  ("Apply N renames" button at the bottom)? One-at-a-time is simpler;
  batch matches how the delete UI works.
- Should the autocomplete suggest ONLY DVDCompare-derived names, or also
  include free-form anything? Free-form trumps for the "I know what this
  is, just let me type it" case.
- The `allKnownNames` field could get noisy on releases with 50+ extras.
  Consider truncating or paginating if real-world data warrants.
- For #3, when `autoNameDuplicates: false` but the run is non-interactive
  (no SSE consumer), how does it resolve? Probably falls through to
  `(2)/(3)` like today, but worth confirming before shipping.

## File map (entry points)

- `src/api/schemas.ts` — add `autoNameDuplicates` to the
  `nameSpecialFeaturesRequestSchema`; new `renameFileRequestSchema`.
- `src/api/routes/fileRoutes.ts` — new `POST /files/rename` endpoint.
- `src/app-commands/nameSpecialFeatures.ts` — emit `allKnownNames` in the
  trailing summary; add the duplicate-detection branch that prompts when
  `autoNameDuplicates: false`.
- `src/tools/parseSpecialFeatures.ts` — expose a flattened name list helper.
- `src/tools/getUserSearchInput.ts` — already extended in Phase A; reuse.
- `public/api/builder/index.html` — `renderNameSpecialFeaturesResultsHtml`
  becomes interactive. `showPromptModal` already supports the Play button
  from Phase A.
- `public/api/builder/js/components/file-explorer-modal.js` — no changes;
  Phase B reuses Phase A's `openVideoModal`.

## Notes from prior planning

- The user explicitly preferred `(2) NAME / (3) NAME` over silent
  permanent-deletes when there's a rename conflict.
- The user's environment on Windows uses a network drive (`G:\Disc-Rips`)
  — duplicate-detection prompts must work alongside the existing
  network-drive permanent-delete downgrade in [deleteFiles.ts](src/tools/deleteFiles.ts).
- The `autoNameDuplicates` toggle was queued at the time PR #12 merged;
  this doc is the canonical place for that scope.
