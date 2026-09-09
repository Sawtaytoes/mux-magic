# A Discogs cover must be square, and a title check must not compare nothing

- **Status:** Accepted
- **Date:** 2026-09-08
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —

This record fixes two defects in
[Discogs joins the cover-art chain by identifier](2026-09-08-discogs-joins-the-cover-art-chain-by-identifier-and-itunes-must-confirm-a-match.md).
That record still stands; these are corrections inside it.

Source: chat `t3code-45f549d9`, and the run over the 186 album folders in this library that had
no artwork.

## Decision

**1. A Discogs image is only a cover candidate when its shape is square enough.** The accepted
band is an aspect ratio of 0.8 to 1.25. Among the images that pass, `primary` wins; otherwise the
largest one does. A release whose images ALL fail returns null, and the chain carries on to iTunes
and then to the album folder.

An image whose width or height Discogs does not record is refused. An unchecked image is the thing
this guard exists to stop.

**2. A title comparison that normalises to nothing is not a match.** `getIsTitleMatch` now compares
with a normaliser that keeps letters and numbers in ANY script, and refuses when either side has
nothing left. It also drops a trailing bracketed qualifier, because Discogs writes a Japanese
release as `Chara No Mori (チャラの森)` where the tags carry only the romanisation.

The same empty-comparison guard is added to the iTunes name test, which uses the Latin-only
`normaliseForComparison` and had the same hole.

## Why

A wrong cover is worse than no cover, and both of these were WRONG in a way no automated check
could have noticed: the image was the right release, from the right identifier, and the picture
was still not the album's front. The only thing that separates a cover from a back tray or a
photograph of a case is its shape. The title defect is the same class — a check that reads as
passing while comparing nothing is more dangerous than no check, because it makes the identifier
path look guarded when it is not.

## Context — what went wrong

The chain proposed 17 covers for 186 albums. Every one was inspected as an image before anything
was written. Two were wrong, and both came through `selectDiscogsFrontImageUrl`:

- **Lambert, Hendricks & Ross — *The Best of the Best!*** Discogs holds one image for that
  release, marked **`primary`**, and it is a 600x281 scan of the back tray and the front laid side
  by side.
- ***Feel Good Rock: Songs You Know by Heart*.** One `secondary` image, 600x450 — a photograph of
  the jewel case lying on a desk, at an angle, with a shop's price sticker on it.

`primary` on Discogs means "the release's lead image", NOT "the front cover". That is why the old
rule — primary, else the first image — could not separate them. Shape can: an album cover is
square, and 4:3 is a camera's aspect ratio, which is the tell for a photograph of the case rather
than a scan of the cover. The band stops short of it at 5:4.

The title defect was found in the same audit. `normaliseForComparison` keeps only `a-z0-9`, so
恋恋風歌, つぼみ and シナリオ all normalise to the **empty string** — and two empty strings are
equal. Three of the twelve Discogs matches passed a check that was doing nothing. All three turned
out to be correct, confirmed independently because the Discogs catalogue number equalled the
MusicBrainz catalogue number in every one of the twelve. That is luck, not a check.

## What we rejected — DO NOT revert to this

**Do not go back to "primary, else the first image".** It is what put a back cover and a photograph
of a jewel case onto two albums. `primary` is not `front`.

**Do not restrict the choice to `primary` images instead.** That would not have caught the Lambert
spread, which IS the primary image, and it would lose the correct covers on releases that have no
primary at all — 恋恋風歌, つぼみ and *Feel Good Rock*'s neighbours in this same run.

**Do not widen the aspect band to take 4:3.** A 4:3 image is a photograph, and the run has one
example of exactly that being wrong. If a genuine 4:3 cover is ever refused, the album falls
through to iTunes and then to the folder, which is the designed behaviour, not a failure.

**Do not add a minimum resolution.** BEAT CRUSADERS — *GIRL FRIDAY* has one Discogs image at
180x161. It is the correct cover and it is the only one that exists in the chain. A small correct
cover beats a blank album; the owner can replace it. Refusing it would be the tool deciding that
no artwork is better than imperfect artwork, which is the opposite of the standing rule.

**Do not compare titles with a Latin-only normaliser on the identifier path.** It silently disables
the check for exactly the releases this provider exists to serve — Japanese, Korean and Cyrillic
releases that the Cover Art Archive does not cover.

**Do not "simplify" the empty-string guard away as a null check.** The strings are not null. They
are non-empty titles that become empty after normalisation, which reads as a successful comparison.

## Evidence

- 17 proposals inspected as images; 14 installed, 3 held back
- `packages/core/src/tools/discogsArtwork.test.ts` — the Lambert spread, the 4:3 case photograph,
  the bracketed native title and two different Japanese titles are all real data from this run
- `packages/core/src/tools/itunesArtwork.test.ts` — the empty-normalisation refusal
- Checked against the twelve real Discogs releases: all twelve titles still match, and only the two
  bad images are refused
