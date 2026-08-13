# Disc-backup title selection — a web UI for deciding what to keep

> [!NOTE]
> **Status: partly built; piece A is LIVE (2026-08-13).** Merged in #205,
> deployed, and verified against `[BACKUP] Desk Set - Blu-ray` through the
> running app. `makemkvcon` is in the image and the MakeMKV key is bound
> in. **Next agent: start from
> [HANDOFF-disc-backup-title-selection.md](HANDOFF-disc-backup-title-selection.md).**
>
> Piece **A (the analyser) has shipped** — `analyseDiscBackup`, the MakeMKV robot-mode reader, the
> segment-map clustering and eight named heuristic rules, all tested
> against **seven real backups** committed as fixtures. Pieces **B (the
> review UI)** and **C (execution)** are not built yet.
>
> The sketch below is kept as written, because its per-item ⚠️ caveats are
> what the implementation was checked against — and two of them turned out
> to matter. **Where the evidence disagrees with the sketch, the evidence
> wins**; those corrections are recorded in "What the real backups changed"
> immediately below, and the four open questions are answered at the end.

## What the real backups changed

Capturing `makemkvcon -r --cache=1 --minlength=0 info` against seven
`[BACKUP]` folders before writing any rules corrected four assumptions:

1. **Segment maps are exposed — but they are TRUNCATED.** `TINFO`
   attribute 26 carries the map, so clustering needs no `.mpls` parser for
   a single-segment feature. But makemkvcon caps the field around 370
   characters and ends it with `...`, so a long playlist's map is a
   **prefix**. Modelled as `isSegmentMapTruncated`; no rule may claim two
   long playlists are identical, because the difference could be entirely
   in the elided tail. A `.mpls` parser is therefore **required** for
   multi-segment titles, not optional.

2. **"Large file without chapters → useless" does not generalise to
   "long".** The Troy bonus disc's real featurettes are 1–17 minute
   chapterless `.m2ts` titles; a "long chapterless → discard" rule would
   propose throwing away ~20 genuine extras. `isChapterlessLongTitle`'s
   floor is **feature length** (45 min), and in the current corpus it
   fires on nothing — the chapterless things worth discarding are all
   caught, with a better reason, by `isChapterlessTwin`.

3. **Menu loops have MANY chapters, not zero.** The sketch guessed "tiny,
   chapterless". Real menu loops carry a chapter per button — 87 chapters
   in 1:27 (The Outfit), 271 in 4:31 (Troy bonus) — and no audio track at
   all. `isMenuLoop` keys on chapter *density* plus missing audio; a rule
   keyed on "no chapters" would have missed every one.

4. **Soylent Green's three "editions" are confirmed as one video**, and
   the raw `00425.m2ts` twin carries *every* track the three playlists
   expose between them (LPCM 1.0 + 3 × DD 2.0). So it is not a duplicate
   to discard — it is the cheap single-pass rip source. That inverts the
   "no chapters = junk" rule, so it is surfaced as `inspect` rather than
   taken silently.

## Original sketch (2026-07-26)

**Status at the time: design sketch, nothing built.** Written from the
owner's description. No code existed, no disc had been analysed by it, and
every disc-specific pattern below was **owner recall that still needed
validating against real backups** — called out per-item rather than
presented as fact.

Input comes from [`rip-deck`](/mnt/TrueNAS-Apps/Repos/rip-deck), which rips whole
discs and marks them `[BACKUP] {title} ({year}) - {type}` on the Disc-Rips
dataset. Those folders are complete BDMV/VIDEO_TS structures with **every**
title still in them.

---

## The problem, in the owner's words

> "The hardest part with these rips is making sure I can find all the editions.
> Some are literally the same scenes with a few swapped which is why I use
> MakeMKV as a post-processing step. This way, it prevents ripping those
> duplicate entries, but then I can post-process the backup and pull out the
> important bits manually."

So the workflow today is: `rip-deck` backs up the whole disc → the owner opens it
in MakeMKV by hand → squints at a list of near-identical titles → picks the real
ones. **That squinting is the thing to automate.**

The goal is not to make the decision unilaterally. It is:

> "have mux-magic identify what to rip and not to rip and then present that to
> me in a way that I can verify and make sure it's right."

**Propose, explain, let the human confirm.** A wrong automatic choice that
silently discards the only copy of an edition is far worse than a slow manual
pass, so the UI's job is to make verification fast — not to remove it.

---

## The signals

Ordered roughly by how reliable and how cheap they are. Everything here is
derivable from `makemkvcon info` output plus the on-disc playlist structure; none
of it needs a re-rip, because the whole disc is already on the pool.

### 1. Chapters — the cheapest quality filter

> "Does it have chapters? If it's a large file without chapters, then it's
> probably useless."

A long title with **no chapter marks** is very likely playlist padding, a
looping menu background, or a studio anti-rip dummy. This is the first pass and
the highest-confidence discard signal.

⚠️ Discard is still a *proposal*. Chapter-less long titles are the classic
anti-rip decoy, but they are not guaranteed to be junk.

### 2. Shared segments — the duplicate-edition detector

> "Do different videos use the same segments? Is one the Eng/Jpn vs
> Eng/Esp/Fr/De/It etc?"

Blu-ray playlists are built from `.m2ts` segment lists. Two titles that
reference **the same segments in the same order** are the same film with
different audio/subtitle sets — not different editions. Two that share *most*
segments but differ in a handful are a genuinely different cut (theatrical vs
extended, or a censored/regional variant).

This is the single most valuable computation here, and it is pure set
arithmetic over the playlist structure. Group titles by segment-list similarity
and the near-duplicate explosion collapses into a handful of real clusters.

**Present the diff, not just the verdict** — "these two differ only in segments
14–17" is exactly what lets the owner confirm in seconds.

### 3. Disney text-swap editions

> "Sometimes, different editions in Disney movies are the same aside from the
> scenes. They have the English copy, then the French text, then the Spanish
> text version. All show as different full-length files, and it's hard to tell
> which is which without knowing the pattern. Typically, mls0800 or something is
> the English one. But that's only for the main feature and only for BDs (not
> UHD)."

Same runtime, same chapters, near-identical segments — differing only in the
segments carrying **on-screen text** (titles, signs, credits). Falls out of
signal 2 naturally: a cluster of full-length siblings differing in a few
segments, on a Disney disc, is almost certainly the localised-text set.

⚠️ **`mls0800` is remembered, not verified**, and the owner explicitly scoped it:
main feature only, **BD only, not UHD**. Treat it as a tie-breaker hint that
must be confirmed against real discs before it is trusted — never as the primary
rule.

### 4. Ghibli sides

> "Ghibli movies have different sides. I often use the English, not the Japanese
> ones, but I think it only affects the intro and outro credits which means I
> should be taking the Japanese 'side' in those cases."

Note the owner correcting himself mid-sentence — the *preference* changes once
you know the difference is only credits. That is precisely the kind of thing a
UI should surface: **"these two differ only in the first and last N segments"**
lets him pick knowingly rather than by habit.

⚠️ "only affects intro/outro credits" is the owner's belief and needs checking
per title. If a Ghibli disc ever differs in the *body*, a rule that assumed
credits-only would silently take the wrong side.

### 5. Length/segment editions — rip them all

> "Sometimes, there are different editions by the length of the files, different
> segments, etc. We can rip all those, and I can post-process to figure them
> out. So long as they all have chapters, we're good."

The explicit instruction is **keep everything plausible**. Where signals
disagree, the correct default is to propose keeping — the disc backup is already
paid for, and disk is cheaper than a re-rip of a disc that may since have gone
back in a box.

### 6. Split main feature + commentary — the hard one

> "Sometimes, the main feature is split in 2, and one has the main audio and the
> other is the audio commentary. That's tough. With MakeMKV, you can't just rip
> the audio, so you need to rip both features and then know to join them
> together."

Detection: two titles, same runtime, same segments, differing **only** in audio
tracks. Then the output is not a choice between them — it is a **merge
instruction**: keep the video from one, graft the commentary audio from the
other.

mux-magic already has the muxing primitives (`mergeTracks`, `replaceTracks`), so
this can produce a real, runnable plan rather than just a recommendation.

---

## Japanese anime discs

Called out separately because the owner flagged them as "even more different".

### "Play All" needing chapter splitting

> "The anime itself often comes as a 'Play All', and I need to divvy it up by
> chapters (chapter splitting is part of mux-magic), but I have to select the
> chapters manually by checking the file. It doesn't do that for me yet. It was
> something I _was_ looking into but hadn't pursued."

`splitChapters` exists in `packages/core/src/app-commands/splitChapters.ts`.
**The missing half is choosing the split points**, which is manual today.

Signals worth trying, none validated:
- Even chapter spacing at a plausible episode runtime (~24 min, ~12 min for
  shorts) — an episode boundary is usually a chapter mark.
- Repeated OP/ED segments at regular intervals: the same segment recurring every
  ~24 minutes is a strong episode-boundary marker, and it reuses signal 2's
  segment identity work.
- Total runtime ÷ plausible episode count landing on a near-integer.

**This must stay proposal-plus-preview.** A mis-split silently truncates
episodes, and the owner would rather confirm boundaries than repair them.

### Episodes that are secretly commentary

> "Other times, Japanese anime discs have the 'Play All' and the individual
> episodes, but the episodes only contain the audio commentary for instance.
> It's a mixed bag."

So "individual episode titles exist" does **not** mean "use those instead of
splitting the Play All". Same shape as signal 6: same video, different audio.
The detector is the same — compare audio track sets between the Play All's
corresponding range and the standalone title.

---

## Proposed shape

Three separable pieces. Only the first is strictly needed to be useful.

### A. An analyser (no UI)

Reads a `[BACKUP]` folder, runs `makemkvcon info` against the on-disc structure,
and emits a **title graph**: every title with runtime, chapter count, segment
list, audio/subtitle tracks, plus computed clusters and a proposed
keep/discard/merge disposition with a **stated reason** per title.

Reason strings are the product. "Discarded: 2h04m with no chapters" and "Same
segments as Title 3, differs only in audio (commentary?)" are what make the UI
verifiable at a glance.

### B. A review UI

A table of clusters, not of titles — collapsing the near-duplicate explosion is
the whole point. Per cluster: the proposal, the reason, the segment diff, and
the tracks. The owner confirms, overrides, or flags.

Existing mux-magic pieces to lean on: the seekable transcode video player
(worker `7e`) makes "jump to segment 14 in both and compare" a real workflow,
and the file explorer's preview already handles this content.

### C. An execution step

Turn the confirmed dispositions into mux-magic operations — extract the kept
titles, run the merges, split the Play All at confirmed chapters, and name the
outputs. This is where the existing command surface already does the work.

---

## Why this is worth building

> "since we know the special features, the release, and the editions and lengths
> of movies and episodes, we should be able to automate a ton of this!"

And the framing that should drive the design:

> "If we could do stuff like that, then I, as a human, shouldn't have to be
> involved in the rip."

Note **the rip** — not the review. The rip is already unattended in `rip-deck`.
This closes the remaining manual step, and it degrades gracefully: even a
partial analyser that only implements signals 1 and 2 removes most of the
squinting, because those two alone collapse the duplicate explosion.

---

## What will make or break this

- **It needs a corpus.** As the owner put it: *"This would take a lot of testing
  to set up across a bunch of disc images, but it could be very useful."* Every
  pattern above is a hypothesis until it is run against real backups from
  several studios. The `[BACKUP]` folders **are** that corpus, and they
  accumulate for free as `rip-deck` runs.
- **Studio patterns are conventions, not standards.** `mls0800`, Ghibli sides
  and Disney text-swaps are per-studio habits that change between releases.
  Encode them as **named, individually-testable heuristics with confidence
  levels**, never as hardcoded assumptions — so a wrong one can be disabled
  without unpicking the analyser.
- **Never silently discard.** Every discard is a proposal with a reason, and the
  full title list stays available. The backup is not deleted by this process.
- **Record what the owner decides.** Each confirmation is a labelled example. Over
  time those become the regression corpus — and the thing that lets the
  heuristics get *measurably* better rather than just accumulating.

## Open questions — answered 2026-08-12

**1. Does `makemkvcon info` expose segment lists richly enough, or does
this need to parse `BDMV/PLAYLIST/*.mpls` directly?**
**Both.** `TINFO` attribute 26 gives the segment map, and for a
single-segment feature that is exact and sufficient — which is how the
Soylent Green, Troy and Larry Flynt clusters are resolved with no `.mpls`
parsing at all. But the field is truncated at ~370 characters, so
multi-segment playlists get a prefix only. A `.mpls` parser is still
needed for those, and separately for chapter marks and PID→track mapping
during execution.

**2. UHD discs are out of scope for `mls0800` — different rule set, or
just no studio hint?**
**Neither, so far: no studio hints are encoded at all.** Every rule in the
registry keys on structure (segment maps, chapter density, track sets),
not on studio filename conventions, and all eight behave identically on
BD and UHD across the corpus (three UHD and three BD backups). The Disney
`mls0800` pattern, Ghibli sides and anime Play-All splitting are
deliberately **absent** from the registry until a matching backup has been
run through the analyser — and the general-purpose `isDistinctCut` rule
already detects the shape all three take, answering "keep both, here is
the segment diff", which is the safe answer for each.

**3. Automatic on `[BACKUP]` appearance, or on demand?**
**On demand, for now.** `analyseDiscBackup` is a normal command on all
five wiring surfaces (CLI, HTTP, builder), so it composes into a sequence
like any other step. The analysis is cheap and read-only, so a watch or a
`rip-deck` trigger can be added later without changing anything here; it
was left out because a queue of pending reviews needs the review UI
(piece B) to exist first.

**4. Where do confirmed decisions live so they survive a re-analysis?**
**In the backup, in a second file.** `DISC-ANALYSIS/analysis.json` is
machine output and is rewritten on every run;
`DISC-ANALYSIS/confirmed.json` is the human decision and is never
overwritten by the analyser. Recorded as
[a decision](decisions/2026-08-12-confirmed-dispositions-are-the-regression-corpus.md).
