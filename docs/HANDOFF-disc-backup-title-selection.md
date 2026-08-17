# HANDOFF — disc-backup title selection

**Written 2026-08-13.** Piece A (the analyser) is **built, merged (#205),
deployed and verified in production**. Piece C.1 (extraction of simple
titles) followed the same day — **built, merged (#229), deployed, and
carried a real disc all the way into `Movies/`**. Piece C.2 followed on
2026-08-17 for the **superset** case (#233), which carried the Soylent
Green UHD backup into `Movies/`. Piece B (review UI), C.2's PID-grafting
remainder, C.3 and D (the probe step) are not built. This
is what the next agent needs.

Read first: [`docs/disc-backup-title-selection.md`](disc-backup-title-selection.md)
— the original design sketch, now carrying a status header, a "what the
real backups changed" section, and its four open questions answered.

---

## What is live right now

`analyseDiscBackup` runs against the deployed app and works end to end:

```bash
curl -X POST https://mux-magic.octen.dev/api/commands/analyseDiscBackup \
  -H 'Content-Type: application/json' \
  -d '{"sourcePath":"/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray"}'
```

Note the path is **`/api/commands/<name>`**, not `/jobs/<name>`.

Verified 2026-08-13 on `[BACKUP] Desk Set - Blu-ray`: 61 titles, 56 keep /
5 discard, writing `DISC-ANALYSIS/analysis.json` (171 KB) into the backup.
The result matched the committed fixture's prediction exactly. That run was
at the then-default `--minlength=0`; the default is now **60** (see the last
section), so a re-run reports fewer titles.

**Deployment, already done — don't redo it:**

- `makemkvcon` is in the image (`/opt/makemkv`, on `PATH`). The Dockerfile
  asserts the transplant at build time by matching `MSG:1005.*started`;
  that step ran and passed in the real build (`docker-deploy` run for
  `a90f5194`).
- The TrueNAS app has a bind
  `/mnt/TrueNAS-Apps/App-Configs/mux-magic/makemkv` → `/makemkv-config`,
  holding `.MakeMKV/settings.conf` with the key copied from rip-deck's
  (`app_DataDir` / `app_DestinationDir` repointed at mux-magic's paths).
  **The key is not in the image and not in any repo. Never commit it,
  never add code that fetches one.**
- `HOME` is set **per spawn** in `runMakeMkvCon.ts`, never image-wide —
  mux-magic also runs ffmpeg, mkvtoolnix, Playwright and a Python venv.
  See [the ADR](decisions/2026-08-12-makemkvcon-is-embedded-in-the-image.md).

---

## Where the code is

| Thing | Path |
| --- | --- |
| Robot-mode reader (ported from rip-deck) | `packages/core/src/tools/makemkv/` |
| Attribute IDs from `apdefs.h` | `packages/core/src/tools/makemkv/apItemAttributeIds.ts` |
| Seven real robot-mode captures | `packages/core/src/tools/makemkv/__fixtures__/*.robot.log` |
| `.mpls` parser + 3 byte fixtures | `packages/core/src/tools/bluray/parseMpls.ts` |
| Clustering + 8 rules + resolver | `packages/core/src/tools/discTitles/` |
| The command | `packages/core/src/app-commands/analyseDiscBackup.ts` |
| Spawn op (auto-mocked in tests) | `packages/core/src/cli-spawn-operations/runMakeMkvCon.ts` |

Every analyser test runs off committed fixtures with `node:fs` on memfs
and the spawn op auto-mocked, so **no makemkvcon is needed in CI**.

---

## Piece C — `extractDiscTitles`

**C.1 is DONE and deployed** (PR #229, 2026-08-13). `extractDiscTitles`
rips every `keep` title into `EXTRACTED-TITLES/` beside `DISC-ANALYSIS/`,
one `makemkvcon mkv` run per title, and deliberately does no naming — the
`<disc>_tNN.mkv` names are left for `nameSpecialFeaturesDvdCompareTmdb`.
`merge` and `inspect` are not ripped. Proven end to end on Desk Set: 2
titles out, trimmed, named and now in `Movies/Desk Set (1957)/`.

Three things the first real extraction settled, all now encoded:

- **`mkv` mode reports success as MSG:5036 + MSG:5005, NOT 5004.** The
  docs and rip-deck's contracts both say 5004; rip-deck only runs
  `backup`, so its constant has never been exercised. Guarding on 5004
  fails every successful extraction. Capture:
  `__fixtures__/desk-set-bluray-extract-title.robot.log`.
- **makemkvcon exits 0 having saved nothing** — parse the saved-title
  count, never trust the exit code. Same trap as the key check.
- **Title indexes are assigned AFTER `--minlength` filters**, so the rip
  must pass the same value the analysis used or it rips a different
  title.

1. ~~**Simple titles** — `makemkvcon mkv file:<backup> <index> <outDir>`.~~
   **Done.**
2. ~~**Track-set variant clusters** (the Soylent Green case)~~ — **done
   for the superset case (PR #233), and it needed no PID grafting.** When
   a cluster contains a title carrying every track its siblings expose,
   `isRippingTrackSupersets` rips *that* once and grafts the chapter
   marks it lacks from the richest sibling `.mpls` — `mkvpropedit`, in
   place, ~90 ms on a 65 GB file. Soylent Green went from three 65.5 GB
   playlist rips to one, and it is the ONLY option that keeps every
   track: DVDCompare lists an audio commentary plus a 1985 Charlton
   Heston BFI interview as a secondary audio track, and no single
   playlist carries both.

   **Verified against an independent authoring**: 9 of the 12 grafted
   marks land within ~0.6–1.0 s of a chapter on the Blu-ray release of
   the same film (which has 29). Do this check on the next disc too — it
   is the cheapest real evidence that a graft is correct rather than
   merely present.

   Still open: a cluster with **no** superset member, where the audio
   really does have to be grafted **by PID** out of the shared decrypted
   `.m2ts` using `mergeTracks` / `replaceTracks`. `parseMpls` gives you
   the PID per track.
3. **Always-works fallback** — rip every sibling in full and merge. Keep
   it behind a flag. If the graft path ever produces a track-count
   mismatch, fall back rather than guess.
4. **Ordering** — original main audio as track 1 and default,
   commentaries after, deduped subtitles. `reorderTracks` and
   `fixIncorrectDefaultTracks` exist.

Then the existing movie pipeline takes over unchanged: `keepLanguages` →
`nameSpecialFeaturesDvdCompareTmdb` → `moveFiles`, per
[the movie-ingest runbook](/mnt/TrueNAS-Apps/Repos/agentic/docs/runbooks/mux-magic-movie-ingest-runbook.md).
That chain is no longer theoretical — Desk Set went through it on
2026-08-13 with only the naming done by hand (two files, both identities
already certain from the frame grabs, so DVDCompare had nothing to add).

### Traps that already cost time — do not rediscover these

- **`makemkvcon` truncates long segment maps** at ~370 chars with a
  trailing `...`. `TINFO`'s map is a PREFIX for multi-segment playlists.
  That is why `parseMpls` exists and why `isSegmentMapTruncated` gates
  every identity claim. Never compare `segmentMapText` for equality on a
  truncated title.
- **A playlist's clip list can be LONGER than makemkvcon's segment map
  even when untruncated.** Both The Outfit's `00011.mpls` and Soylent's
  `00012.mpls` end with a ~1-second bumper clip makemkvcon omits. Do not
  assert the two match.
- **`.mpls` chapter marks are in each CLIP's timebase and restart at every
  play item** — they are NOT monotonic across a multi-segment playlist.
  Use `getMplsChapterTimesFromPlaylistStart`. Grafting raw marks puts
  every chapter after the first segment in the wrong place.
- **The last chapter mark is usually an end marker**, which is why MakeMKV
  reports one fewer chapter than there are marks. `isPlaylistEndMarker`
  flags it.
- **`mkv` mode reports success as MSG:5036 + MSG:5005, never 5004** — see
  the piece C section. Also: makemkvcon drops a subtitle track silently.
  Soylent's superset analysed as 2 PGS and came out with 1, because
  makemkvcon applies its own default selection profile to what it saves.
  If a track count matters, check the OUTPUT, not the analysis.
- **A stream's track language is `LANG_CODE` (3), not
  `METADATA_LANGUAGE_CODE` (28).** Reading 28 labels every commentary
  "English" on an English disc and hides the thing you are looking for.
- **`.gitignore` has `*.log`.** New `.robot.log` fixtures need the
  existing negation to cover them, or they are silently untracked and the
  suite goes green locally while CI fails every test.

---

## Then: piece B — the review UI

A table of **clusters, not titles** — collapsing the duplicate explosion
is the whole point. Per cluster: proposal, reason, segment diff, track
table, and a ▶ into the existing seekable transcode player.

Model it on `SmartMatchModal` (`packages/web/src/components/SmartMatchModal/`),
which already has this exact shape: server-side scoring with the modal as
a pure presenter, pre-checked above a confidence threshold, per-row
override, play-to-verify, and an Apply that reports per-row failures.

- Confirmed dispositions go to `DISC-ANALYSIS/confirmed.json`, **beside**
  `analysis.json` and never merged into it — re-analysing must never
  destroy a human decision. [ADR](decisions/2026-08-12-confirmed-dispositions-are-the-regression-corpus.md).
- Screenshots on the PR must use **masked, fictional data**
  ([ADR](decisions/2026-08-13-pr-screenshots-use-masked-fake-data.md)) and
  must be attached to the PR itself, not just a `devshare` link.

---

## Also unbuilt: piece D — the probe step

`probeDiscTitles`: decode ~60 s of each ambiguous audio track and
transcribe locally (`faster-whisper` into the existing `/opt/aof-venv`
builder stage), grab a title-card frame of each unidentified extra, match
against DVDCompare via the existing `searchDvdCompare.ts` /
`parseSpecialFeatures.ts`, and hash extracted PGS tracks to collapse
duplicate subtitles.

This is what would close the two gaps metadata cannot:

- **Troy's bonus disc**: ~20 chapterless 1–17 min `.m2ts` featurettes that
  the analyser correctly keeps but cannot name.
- **Soylent Green**: the release lists **two** commentaries; the disc
  carries **three** DD 2.0 tracks. One is unaccounted for.

⚠️ This would be mux-magic's **first model call**. It must stay a *local*
model — no cloud LLM, no API key, offline-capable — so the
deterministic-by-default property holds, and matching transcripts to names
stays deterministic fuzzy text matching. **Write an ADR before merging.**

---

## Rules: what is deliberately NOT encoded

`discTitleRules.ts` is the registry; rules are disableable by name via
`disabledRuleNames`. Three patterns from the sketch are **deliberately
absent** until a matching backup has been run through the analyser:

- Disney `mls0800` localised-text sets (owner's own words: "typically
  mls0800 **or something**" — remembered, not verified, and scoped to the
  main feature on BD only, not UHD).
- Ghibli sides (the belief that only intro/outro credits differ).
- Anime Play-All chapter splitting (`splitChapters` exists; choosing the
  split points does not).

All three take the shape `isDistinctCut` already detects, and its answer —
keep both, show the segment diff — is safe for each. Do not add them
speculatively.

Two rules carry an empty `validatedAgainst`, and a test enforces that an
unvalidated rule may never propose a `discard`:

- `isChapterlessLongTitle` — fires on nothing in the current corpus, which
  is correct. Its floor is **feature length** deliberately: Troy's bonus
  featurettes are chapterless 1–17 min titles and a "long chapterless →
  discard" rule would propose throwing ~20 of them away.
- `isPlayAllStitch` — proposes `inspect`, not `discard`. **This is a
  deliberate deviation from the original plan**, documented in the rule.
  Flip it only once a real Play-All backup has been analysed and the parts
  confirmed complete; on anime discs the relationship inverts and the Play
  All is often the only chaptered copy.

---

## Answered 2026-08-13 — the minimum title length is 60 seconds

For Desk Set the owner said "save all titles". At `--minlength=0` that is
**61 titles**, but only two are real: the 1:43:33 feature (`00850.mpls`) and
a 2:19 trailer (`01395.m2ts`). The other 59 are sub-minute fragments.

He confirmed both halves: only those two are real, and the floor moves to
**one minute** — not the 10-minute floor he uses for straight rips, which
would throw the trailer away. `minimumTitleLengthSeconds` now defaults to
`60` everywhere (core, CLI, API schema); pass `0` to see the fragments
anyway. See
[the decision](decisions/2026-08-13-disc-analysis-minimum-title-length-is-60-seconds.md)
and PR #221.

**So the numbers above are the `--minlength=0` numbers.** A re-run at the new
default reports 2 titles for Desk Set — that is expected, not a regression.

**Closed 2026-08-13:** both titles were extracted, trimmed to English,
named and moved to `Movies/Desk Set (1957)/` (feature + `Theatrical
Trailer -trailer.mkv`), and the 61 GB backup was deleted — hourly ZFS
snapshots cover it, and the disc was ripped weeks ago.
