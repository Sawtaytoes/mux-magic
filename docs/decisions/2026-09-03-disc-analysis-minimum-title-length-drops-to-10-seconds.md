# 2026-09-03 — Disc analysis runs at `--minlength=10`, not 60

- **Status:** Accepted
- **Date decided:** 2026-09-03
- **Area:** core / cli / api / web
- **Supersedes:** [2026-08-13 — Disc analysis runs at `--minlength=60`, not 0](2026-08-13-disc-analysis-minimum-title-length-is-60-seconds.md)
- **Source:** owner, after a Haunting Hour DVD ingest lost three real extras to the 60-second floor.

## Decision

`runMakeMkvCon`, `analyseDiscBackup` and `extractDiscTitles` default
`minimumTitleLengthSeconds` to **10**.

Ten seconds is the floor that removes BDMV fragments without removing content.
The parameter stays exposed on the CLI, the API request schema and the web
command form, and `0` is still there for investigating a disc.

## Why 60 was wrong

The [2026-08-13 decision](2026-08-13-disc-analysis-minimum-title-length-is-60-seconds.md)
chose 60 by rejecting 0. It never evaluated a value in between, and 60 turned
out to sit **above real content**, which is the one thing a floor must not do.

Measured across every `__fixtures__/*.robot.log` we hold — title counts
surviving each floor:

| Fixture | titles | ≥ 0 | ≥ 10 | ≥ 30 | ≥ 60 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `desk-set-bluray` | 61 | 61 | **10** | 3 | 2 |
| `troy-bonus-disc-bluray` | 94 | 94 | 36 | 33 | 28 |
| `soylent-green-uhd` | 18 | 18 | 13 | 11 | 11 |
| `the-outfit-bluray` | 14 | 14 | 12 | 10 | 8 |
| `the-people-vs-larry-flynt-uhd` | 7 | 7 | 4 | 3 | 3 |
| `troy-directors-cut-uhd` | 7 | 7 | 5 | 4 | 4 |
| `troy-theatrical-cut-uhd` | 5 | 5 | 4 | 3 | 3 |

**The objection that produced 60 is answered by 10.** Desk Set was the disc that
caused it — "61 titles, of which exactly 2 are content". At 10 it reports **10
titles**, because 51 of its 59 junk fragments are sub-ten-second. The noise the
owner stopped extraction over is gone without putting the floor above content.

**And 60 was actively losing extras.** Three known cases, all silent — a title
below the floor is not proposed, not discarded-with-a-reason, and not counted;
it simply is not in the output:

1. **Soylent Green's 12-second image gallery.** Recorded in
   [the disc handoff](../HANDOFF-disc-backup-title-selection.md) as
   *"invisible at the 60-second floor entirely"* — one of the three galleries
   that pass lost. It survives at 10.
2. **The Haunting Hour DVD's 0:58 featurette** (*On-Set with Bailee & Connor*).
3. **That disc's two 0:30 Hub promos**, one per episode on the disc.

The Haunting Hour disc is the clearest case: at 60 it reports 10 titles, at 0 it
reports 14, and **three of the four extra titles are real content** the operator
would have to know to go looking for. The fourth is the anti-piracy card.

## What we rejected

**Staying at 60.** It is above the runtime of an ordinary television promo. A
30-second spot is the most common short extra on a TV-season DVD, and the floor
that hides it is not a floor, it is a filter on content.

**Going to 0.** Unchanged from 2026-08-13, and the Desk Set numbers above are why:
61 titles of which 59 are fragments. "Propose, never silently discard" is about
titles, not about every byte range MakeMKV can address.

**A per-disc-type default** (10 for DVD, 60 for Blu-ray). Rejected as a second
thing to get wrong. The fixture table shows 10 is safe on Blu-ray too — it costs
Troy's bonus disc 8 extra rows and Desk Set 8, and every one of those is
proposed with a disposition rather than ripped.

**Anything below 10.** Nothing we have seen between 1 and 10 seconds is content.
Desk Set's 51 sub-ten-second entries are BDMV fragments, and a DVD's still-menu
galleries are in the menu domain where MakeMKV exposes no title at **any** floor
([handoff §3](../HANDOFF-disc-backup-title-selection.md)).

## Consequences

⚠️ **Title indexes move.** MakeMKV numbers titles *after* applying the filter, so
the same disc read at 10 and at 60 numbers them differently. Any saved job,
template or written-down index list captured under the old default refers to
different titles now. The analysis pass and the rip pass must still be given the
same value — that rule is unchanged and is what `runMakeMkvConExtract`'s comment
and `extractDiscTitles`' test cover.

The owner's own setting predates all of this: *"Even in Windows, I had it at
10s. I don't like the default to be 60s."*
