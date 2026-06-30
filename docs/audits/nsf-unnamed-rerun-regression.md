# Regression — NSF no longer re-offers Smart Match for already-bucketed files

**Status:** Fixed on `feat/mux-magic-revamp` 2026-06-29 (server read-back; see "Fix landed" below). UNNAMED-FEATURES/ only — DUPLICATES/ and bucket-file auto-rematch remain follow-ups.
**Area:** `nameSpecialFeaturesDvdCompareTmdb` (NSF) → Smart Match / "Fix Unnamed" flow
**Introduced by:** Worker 25 (`feat/mux-magic-revamp`) — auto-bucketing + skip-on-re-run
**First reproduced:** 2026-06-29, on `feat/mux-magic-revamp` (now also on `master` — the two branches were made identical at commit `c4aa9371` on 2026-06-29)
**Reporter model framing:** "features that keep appearing and disappearing between code edits" — this is one of them.

> For the documenting agent: this file is self-contained. Every claim below is
> backed by a git ref or a `file:line` you can open directly. You should not need
> to re-derive anything.

---

## One-line summary

Unmatched special-feature files used to be re-offered for renaming on **every** NSF
re-run. Worker 25 started **moving** them into `UNNAMED-FEATURES/` (and dropped
duplicates into `DUPLICATES/`) and then **deliberately skips those folders on
re-run**, so a second run finds nothing to name and the Smart Match modal never
opens. The write-half of the "filesystem is the cache" design shipped; the
read-half (scan the buckets back in) was scoped out and never built.

---

## User-visible symptom

1. Run NSF on a disc-rip folder. Some files don't match a DVDCompare timecode →
   they auto-move into `<sourcePath>/UNNAMED-FEATURES/`.
2. Refresh / close / come back later and **re-run** NSF on the same folder.
3. Result: `Renamed 0. Files not renamed: 0.`, log says
   `[BUCKET FOLDER PRESENT] UNNAMED-FEATURES/ already exists with N files — skipped.`,
   and the emitted summary has `unrenamedFilenames: []`, `possibleNames: []`.
4. The "✨ Fix Unnamed" / Smart Match modal **does not appear** — there is nothing
   to populate it, even though the files are sitting in `UNNAMED-FEATURES/` and
   DVDCompare candidate names are available (they show up in `allKnownNames`).

Note `allKnownNames` is populated straight from the DVDCompare scrape, so its
presence in the log is a red herring — it does not depend on the files and never
drives the modal.

---

## Reproducer

```sh
# Pre-populate the bucket as if a prior run left leftovers:
mkdir -p "/media/Disc-Rips/<Title> - Blu-ray/UNNAMED-FEATURES"
mv title_t0*.mkv "/media/Disc-Rips/<Title> - Blu-ray/UNNAMED-FEATURES/"

# Run NSF on the parent folder (UI step or CLI). Observe:
#   [BUCKET FOLDER PRESENT] ... skipped
#   [RENAMING] Renaming matched files (0 of 0)
#   summary: unrenamedFilenames=[], possibleNames=[]
# -> Smart Match modal never opens.
```

---

## Root cause (code path)

The run enumerates source files with depth-0 (top-level only):

- [`nameSpecialFeaturesDvdCompareTmdb.ts:189`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts#L189)
  — `getFilesAtDepth({ depth: 0, sourcePath })`.
- [`getFilesAtDepth.ts:17-18`](../../packages/tools/src/getFilesAtDepth.ts#L17-L18)
  — `depth: 0` runs only `getFiles({ sourcePath })`; **no recursion** into
  subfolders, so `UNNAMED-FEATURES/` and `DUPLICATES/` are never read.

With the leftovers living inside the bucket, the top level has zero loose files,
so downstream everything collapses to empty:

- `matches = []` → `renames = []` → `leftoverMatches = []`.
- `unrenamedFilenames` is built from `leftoverMatches`
  ([`...Tmdb.ts:348-351`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts#L348-L351)) → `[]`.
- `possibleNamesForSummary` is **gated** on `unrenamedFilenames.length > 0`
  ([`...Tmdb.ts:373-382`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts#L373-L382)) → `[]`.
- `unnamedFileCandidates` → `[]` → emitted as `undefined`
  ([`...Tmdb.ts:585-588`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts#L585-L588)).

The web side keys the modal off those fields
([`findNsfResults.ts:59-70`](../../packages/web/src/components/NsfRunResults/findNsfResults.ts#L59-L70)),
and Worker 7b only auto-opens when `isSmartMatchAvailable === true`
([`7b doc:33`](../workers/7b_smartmatch-auto-open-on-nsf-completion.md#L33)) — which
is false here. So nothing opens.

The `[BUCKET FOLDER PRESENT] … skipped` log is cosmetic only —
`logBucketFolderCountsIfPresent` ends in `ignoreElements()`
([`...buckets.ts:65-91`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts#L65-L91)).
The actual "skip" is just depth-0 never looking inside the bucket.

---

## Why it worked before (the disappearance)

Before Worker 25, leftover/unmatched files were **never moved** — they stayed in
`sourcePath`. So a re-run re-enumerated them, regenerated the summary, and
re-offered Smart Match *every time*. The modal's `unrenamedFilenames > 0 &&
possibleNames > 0` gate was fine because the summary was regenerated on each run.

Worker 25 introduced two coupled changes that, together, removed that behavior:

1. **Auto-route leftovers into buckets** — unmatched → `UNNAMED-FEATURES/`,
   dropped duplicates → `DUPLICATES/`. Folder names defined at
   [`...buckets.ts:32-33`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts#L32-L33).
   Write logic: `moveFilesToBucket`
   ([`...buckets.ts:93-130`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts#L93-L130)).
2. **Skip bucket folders on re-run** — Worker 25 spec §4
   ([`25 doc:94-98`](../workers/25_nsf-fix-unnamed-overhaul.md#L94-L98)):
   *"log a one-line summary of bucket counts and never enumerate into them."*

Step 1 pulled the files out of the enumeration path; step 2 made re-runs ignore
where they went. The documented recovery (`25 doc:28,37`) is **manual** only:
browse the folder in Explorer, or drag a file back into `sourcePath` to re-enter
the pipeline on the next run.

### Provenance of the related pieces (for the appearing/disappearing timeline)

- Legacy v1.0.0 Smart Match modal **built** in `a7fef431` (2026-05-08,
  `public/builder/js/components/specials-mapping-modal.js`).
- **Deleted** in `28534ec5` (2026-05-10) when the whole legacy `public/builder/`
  app was removed.
- **Re-ported** to React by Worker 58 Part B (see
  [`v1.0.0-feature-parity.md:41`](./v1.0.0-feature-parity.md#L41)).
- Worker 25 bucket auto-routing added in `3bc676b7`
  (`feat(core): auto-route NSF leftovers + dropped dupes into UNNAMED-FEATURES/ DUPLICATES/`).
- The legacy modal had the **same** within-run gate, so this regression is not the
  modal port — it's specifically the bucketing-without-readback from Worker 25.

The `docs/options/` design notes the user wrote (multiple candidate destination
folders) were archived in commit `b6bd9d4a`
(`docs(react-migration): archive stale docs`).

---

## Fix landed (2026-06-29, `feat/mux-magic-revamp`)

Implemented the read-back, server-side only — the web/modal wiring already
handled the rest:

- New `readBucketUnrenamedFiles({ sourcePath, bucketName })` in
  [`...buckets.ts`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts)
  — reads `UNNAMED-FEATURES/`, measures each file's duration via
  `getMediaInfo` → `getFileDuration`, returns `UnrenamedFile[]`. Absent/empty
  bucket → `[]`; a per-file mediainfo failure degrades to `durationSeconds: null`
  rather than dropping the file.
- [`...Tmdb.ts`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts)
  reads the bucket right after `toArray()` (before `bucketMoves$` moves *this*
  run's leftovers in, so the two sets never double-count) and folds the bucket
  files into `unrenamedFiles` / `unrenamedFilenames`. Surface-only: bucket files
  are **not** renamed or re-bucketed; `leftoverFullPaths` (the `bucketMoves$`
  input) still derives from this-run leftovers only.
- No web change needed: `isSmartMatchAvailable`
  ([`NsfRunResults.tsx:44-47`](../../packages/web/src/components/NsfRunResults/NsfRunResults.tsx#L44-L47))
  keys off `summary.unnamedFileCandidates.length > 0`, which now populates from
  the bucket, so Worker 7b auto-opens the modal and its Apply already targets
  `UNNAMED-FEATURES/`.

**Tests:** [`...bucketReadback.test.ts`](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.bucketReadback.test.ts)
— re-run with only bucket files surfaces them as `unnamedFileCandidates`; empty/
absent bucket leaves the summary unchanged. Full core suite green (814 tests).

**Still open (follow-ups):**

- `DUPLICATES/` is not read back — the modal's Apply `oldPath` is hard-coded to
  the `UNNAMED-FEATURES` constant ([`smartMatchTypes.ts:19`](../../packages/web/src/components/SmartMatchModal/smartMatchTypes.ts#L19)),
  so surfacing DUPLICATES needs a per-file bucket field on the candidate.
- No **auto-rematch**: a bucketed file that would now match (e.g. user fixed
  padding/offset) is surfaced for manual Smart Match, not auto-renamed back. Pre-
  Worker-25 behavior auto-renamed it. Acceptable since the modal is the intended
  mechanism, but worth a follow-up if the user wants the old auto behavior.
- No **e2e** yet — the strongest guard is the core test above; an e2e
  (pre-populate bucket → run step → modal auto-opens → Apply moves back) is the
  ideal complement and needs a fake-data scenario for the bucket-present case.

## Fix direction (original plan — now implemented above)

Replace §4's "skip and never enumerate" with **"skip from matching, but surface
for Smart Match."** Concretely:

- At run start, in addition to the depth-0 `sourcePath` files, **scan the bucket
  folders** (`UNNAMED-FEATURES/`, `DUPLICATES/`) for files.
- Run each bucketed file through the existing pipeline pieces — `getMediaInfo` →
  duration → `rankCandidates` — and emit them as unnamed candidates **even when
  `sourcePath` has no loose files**, so the summary repopulates and Worker 7b
  auto-opens the modal.
- The Apply path already handles this: it POSTs
  `oldPath: …/UNNAMED-FEATURES/<file>` → `newPath: …/<newName>.<ext>`
  ([`25 doc:100-107`](../workers/25_nsf-fix-unnamed-overhaul.md#L100-L107)), i.e.
  rename-and-move-back in one op. **Only the discovery/read side is missing.**

### Test coverage to add (regression guard)

This regression existed because there was **no test** asserting re-run behavior
against a pre-populated bucket. The fix must land failing-test-first:

- **Core unit:** NSF run against a `sourcePath` whose only files live in
  `UNNAMED-FEATURES/` → summary emits those files as `unnamedFileCandidates` with
  ranked candidates (asserts the read-back, not just the write).
- **e2e:** pre-populate `UNNAMED-FEATURES/`, run the NSF step → Smart Match modal
  auto-opens listing the bucketed files; Apply renames them back into `sourcePath`.

Do **not** close the gap by relaxing existing assertions — the missing coverage is
the bug's root enabler.

---

## Related docs

- Worker 25 spec: [`25_nsf-fix-unnamed-overhaul.md`](../workers/25_nsf-fix-unnamed-overhaul.md)
  (see §4 "Skip bucket folders on re-run" and §5 "SmartMatchModal reads from UNNAMED-FEATURES/").
- Worker 7b auto-open: [`7b_smartmatch-auto-open-on-nsf-completion.md`](../workers/7b_smartmatch-auto-open-on-nsf-completion.md).
- v1.0.0 parity audit: [`v1.0.0-feature-parity.md`](./v1.0.0-feature-parity.md).
</content>
</invoke>
