# 2026-08-13 — Disc analysis runs at `--minlength=60`, not 0

- **Status:** Accepted
- **Date decided:** 2026-08-13
- **Area:** core / cli / api
- **Source:** owner, after the first production `analyseDiscBackup` run on `[BACKUP] Desk Set - Blu-ray` returned 61 titles.

## Decision

`analyseDiscBackup` (and `runMakeMkvCon` underneath it) defaults
`minimumTitleLengthSeconds` to **60**. One minute is the floor at which a
title is still something a person would call content — a feature, a trailer,
a featurette — so everything above it is worth *proposing* with a reason, and
everything below it is a BDMV fragment nobody would ever rip.

The parameter stays exposed on the CLI (`--minimumTitleLengthSeconds`), the
API request schema, and the web command form. `0` remains available for the
one case that needs it: investigating a disc whose real content the floor is
suspected of hiding.

## What we rejected — DO NOT revert to this

**`--minlength=0` as the default.** Phase 1 shipped with 0 on the reasoning
that "propose, never silently discard" required the analyser to see every
title. The first real run disproved it: Desk Set reports **61 titles at 0, of
which exactly 2 are content** — the feature (`00850.mpls`, 1:43:33) and a 2:19
trailer. The other 59 are sub-minute fragments. A proposal list that is 97%
noise is not "proposing" anything; it is handing the operator the raw disc
structure and 59 chances to produce a junk file.

Also rejected: the **10-minute** floor used for straight rips. That is the
right number when you only want the feature, and the wrong one here — it
throws away the trailers and featurettes the analyser exists to classify.

## Why it must not be re-litigated

"Propose, never silently discard" is about **titles**, not about every byte
range MakeMKV can address. The rule is intact at 60: nothing between one
minute and the feature is hidden, and every discard above the floor still
carries a stated reason. Dropping back to 0 re-creates the exact situation
the owner stopped extraction over — 59 junk files waiting to be written.
