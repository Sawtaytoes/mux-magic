# Worker 72 — Dedupe SmartMatch candidates (kill duplicate dropdown entries)

**Status:** ready
**Track:** srv (or shared core)
**Model:** Sonnet
**Effort:** Medium
**Thinking:** ON
**Depends:** — (touches the NSF post-processing path)

## Why

The user pointed at the Smart Match dropdown for the Shrek 2 Blu-ray and noted that many entries appear twice:

- `"Shrek's Interactive Journey: II" Photo Gallery` (with smart quotes) AND `Shrek's Interactive Journey - II Photo Gallery` (parser-normalized) — same DVDCompare entry, two different parse paths.
- `* The Film` — appears once per disc and the page has multiple discs; both copies survive into `possibleNames`.
- `Shrek, Rattle & Roll` — top-level parent + reappears via the cross-disc duplication.
- `Audio Commentary by Directors Kelly Asbury and Conrad Vernon` — once per disc.

11 candidates total for the SF_03 row but at least 4 are duplicates that the user has to mentally skip past. Real candidate pool is ~7.

Two distinct sources of duplication:

1. **Cross-disc duplication.** DVDCompare often lists the same special features on Disc One and Disc Two (e.g. Shrek 2 4K + standard BD). The parser walks line-by-line and emits each occurrence — no dedup awareness.
2. **Normalization variants.** Sometimes the parser produces two variants of the same entry: one with smart quotes preserved (untimed branch), one with quotes stripped via `replaceAll(/"/g, "")` (timed/extras branch). Both reach `possibleNames` when flattened.

Either way, the dropdown's job — "let the user pick a target name" — is harder when half the entries are duplicates of the other half.

## What

Dedupe `possibleNames` at the NSF pipeline boundary, BEFORE it's emitted in the trailing summary record.

### Dedupe key

Normalize each `PossibleName.name` to a canonical form:

- Lowercase.
- Strip smart quotes (`"`, `"`, `“`, `”`) → none.
- Collapse multiple whitespace runs → single space.
- Trim leading/trailing punctuation (`*`, `:`, hyphens — though the parser already strips most of these).
- Maybe: collapse `:` / ` - ` / `:` separators to a canonical `-` so `Shrek's Interactive Journey - II` and `Shrek's Interactive Journey: II` collapse to the same key.

Group entries by `(normalizedName, timecode, parentName)`. Keep the FIRST occurrence (preserving DVDCompare order). Drop the rest.

### Why include `timecode` in the dedupe key

A featurette that appears with timecode `(3:58)` on Disc One but as an untimed line on Disc Two are technically the same entry, but the timed copy is the more useful one for the user. Keeping the timed version specifically lets the dropdown show the runtime. Implementation: when collapsing duplicates, prefer the entry WITH a timecode if at least one variant has one.

### Why include `parentName` in the dedupe key

A child entry whose parent appears twice (Disc One vs Disc Two) shouldn't be treated as duplicate of itself — the parent context is part of the identity. With parent in the key, both copies of `"Accidentally in Love" (under Shrek, Rattle & Roll [Disc One])` AND `"Accidentally in Love" (under Shrek, Rattle & Roll [Disc Two])` collapse to one entry (since the parent name is the same string).

### Where to apply

Best place: `nameSpecialFeaturesDvdCompareTmdb.ts`, right after `parseSpecialFeatures` resolves and before `possibleNamesForSummary` / `flattenExtrasAsPossibleNames` are computed. Add a `dedupePossibleNames(possibleNames: PossibleName[]): PossibleName[]` helper alongside `flattenExtrasAsPossibleNames` in `parseSpecialFeatures.ts`.

### Test coverage

Add unit tests for `dedupePossibleNames` covering:
- Two identical entries collapse to one.
- Smart-quote variant + plain variant collapse to one (the plain one wins since it sorts first after normalize).
- A timed entry beats an untimed duplicate of the same name.
- Different `parentName` keeps both entries.
- Original ordering preserved for non-duplicates.

## Out of scope

- Fuzzy near-match deduplication (e.g. `"Audio Commentary by Directors"` vs `"Audio commentary by directors"` with case differences — these already collapse via lowercase normalize, so this is covered).
- Detecting "this is the same feature on a different disc" by matching timecodes precisely — too fragile, and DVDCompare often has slightly different runtimes per release. The dedupe key only kicks in for actually-identical strings post-normalize.
- Storybook-only stub tests — the real assertion is the unit test.

## Files

- [packages/core/src/tools/parseSpecialFeatures.ts](../../packages/core/src/tools/parseSpecialFeatures.ts) — add `dedupePossibleNames` helper.
- [packages/core/src/tools/parseSpecialFeatures.test.ts](../../packages/core/src/tools/parseSpecialFeatures.test.ts) — add tests for the new helper.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) — pipe `possibleNames` and `flattenExtrasAsPossibleNames(specialFeatures)` through `dedupePossibleNames` before assembling `possibleNamesForSummary`.

## Acceptance

- On the Shrek 2 Blu-ray DVDCompare page (fid=68856), the SmartMatch dropdown shows each unique entry exactly once.
- `* The Film` appears once.
- `Shrek, Rattle & Roll` appears once.
- `Shrek's Interactive Journey: II Photo Gallery` appears once (the smart-quote variant and the plain variant collapse).
- Audio commentary entries appear once each.
- Tests above all green.

## Notes

The user's complaint thread: *"I do wanna remove duplicates. … it's really annoying and makes it hard to search."*
