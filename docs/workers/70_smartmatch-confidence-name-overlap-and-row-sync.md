# Worker 70 — SmartMatch confidence: row badge sync + filename-overlap boost

**Status:** ready
**Track:** web
**Model:** Sonnet
**Effort:** Medium
**Thinking:** ON
**Depends:** 58 (SmartMatch port), 6e (parent-child enrichment landed in `f40467fe`)

## Why

Two coupled bugs the user spotted on the Shrek 2 disc:

### Bug A — row's confidence badge doesn't match the visible selection

In the screenshot of `Far Far Away Idol` (file `Shrek 2-SF_03_FarAwayIdol_t48`), the **row's right-edge confidence pill shows 20%** (amber) but the **trigger inside the row shows 0%** (also amber). The mismatch is because the row uses `suggestion.rankedCandidates[0]` (the TOP-ranked candidate) to compute the badge, not the candidate the user has actually selected.

```ts
// SmartMatchModal.tsx:343-344
const topCandidate = suggestion.rankedCandidates[0]
const confidence = topCandidate?.confidence ?? 0
```

When the user picks a different option from the dropdown (or the modal auto-pre-selected something other than the top), the right-edge badge keeps showing the top-ranked candidate's confidence, not the chosen one's. Confusing because the dropdown trigger ALSO renders a confidence chip — and they disagree.

### Bug B — filename overlap should boost confidence when duration matching fails

The `Far Far Away Idol` row scores 0% even though:

- The filename (`Shrek 2-SF_03_FarAwayIdol_t48`) and the candidate name (`Far Far Away Idol`) share three words: "Far", "Far", "Away", "Idol" (3+ overlap after normalize).
- The duration mismatch (8:55 vs 5:53) is a DVDCompare-side data error — the user verified by watching the file that 5:53 is when credits start, so DVDCompare missed the post-credit runtime.

The scoring at [smartMatchScoring.ts:179-211](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.ts#L179-L211) currently:

1. Computes `durationScore` = 0 (delta 182s > tolerance 90s)
2. Computes `filenameScore` = some positive overlap value
3. Combines with `DURATION_WEIGHT = 0.7` weight on duration → final confidence is dominated by the 0 duration score.

The `FILENAME_ONLY_SCORE_FACTOR = 0.6` multiplier is only applied when the candidate has NO timecode at all, not when the candidate has a timecode but it didn't match. The filename signal gets effectively zeroed out.

## What

### Fix A — sync row badge to selected candidate

Change `topCandidate` / `confidence` in [SmartMatchModal.tsx:343-344](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx#L343-L344) to look up the `ScoredCandidate` whose `candidate.name === row.selectedCandidateName`, falling back to `rankedCandidates[0]` when no match (defensive — shouldn't happen since pre-selection always picks from the ranked list). The badge then mirrors the dropdown trigger's chip — same number, same color.

### Fix B — filename-overlap boost when duration is zero

When `durationScore === 0` AND `filenameScore > 0` AND the candidate has a timecode, fall back to filename-only scoring (`filenameScore * FILENAME_ONLY_SCORE_FACTOR`) instead of letting the duration weight zero out the row. The intent: a timecoded candidate whose runtime is wrong (DVDCompare data errors are common — see `Far Far Away Idol`) should still surface as a moderate-confidence match if the filename overlap signal is strong.

Mechanically: in [`combineScores`](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.ts), if duration weight would normally apply (`hasDuration`) but `durationScore === 0`, fall through to the `filename-only` branch.

Open question for the worker: should the boost be silent or surfaced? E.g. a small "no duration match" badge on the row meta. Default answer is silent (avoid badge proliferation); revisit if users mistake the boosted score for a real duration match.

## Out of scope

- Reworking the whole scoring formula. This worker is a targeted fix for the "filename overlap = strong but duration = 0" case, not a redesign.
- A user-facing scoring-weights slider. If users tune scoring they care more about the rules than the result — defer until users actually ask for it.
- Showing the user *which* signal contributed how much to confidence. Useful debug data lives in `ScoredCandidate.durationScore` / `.filenameScore` but doesn't need to render today.

## Files

- [packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx) — replace `rankedCandidates[0]` lookup with `find(name === selectedCandidateName)`.
- [packages/web/src/components/SmartMatchModal/smartMatchScoring.ts](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.ts) — adjust `combineScores` to fall back to filename-only when duration zero.
- [packages/web/src/components/SmartMatchModal/smartMatchScoring.test.ts](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.test.ts) — add a test for the FarAwayIdol case: timed candidate, file duration far off, strong filename overlap → confidence should be > 20%.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx) — add a test that selecting a non-top candidate updates the row badge to match.

## Acceptance

- The row's right-edge confidence pill always matches the chip on the dropdown trigger.
- A candidate with a timecode whose runtime is wildly off the file's duration (>90s delta) but strong filename overlap surfaces with confidence at the `filename-only` tier instead of 0%.
- New tests cover both fixes.

## Notes

The screenshot in the conversation thread (Image 1 on the rename-modal turn) shows the bug: row badge "20%" amber, dropdown trigger "0%" amber for the same `Far Far Away Idol` row. After the fix, both should read the same value (~36% expected after the filename-only fallback applies for this file/candidate combination).
