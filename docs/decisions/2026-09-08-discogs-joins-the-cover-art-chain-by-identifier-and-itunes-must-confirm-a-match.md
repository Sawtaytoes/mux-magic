# 2026-09-08 — Discogs joins the cover-art chain by identifier, and iTunes must confirm a match

- **Status:** Accepted
- **Date decided:** 2026-09-08
- **Area:** core
- **Source:** chat `t3code-45f549d9`; the audit of all 65 covers the backlog run installed
- **Extends:** [2026-09-05 — Mux Magic writes cover art, and iTunes joins the provider chain](2026-09-05-mux-magic-writes-cover-art-and-itunes-joins-the-provider-chain.md)

## Decision

Two changes to `resolveCoverArtImage`, in that file's documented order.

**1. Discogs is a provider, and it is reached by an IDENTIFIER.** It sits below the Cover Art Archive
and above iTunes. The chain is now:

1. an explicit image URL the caller gave
2. the Cover Art Archive, by MusicBrainz release id
3. the Cover Art Archive, by MusicBrainz release group id
4. TheAudioDB — still the unimplemented seam
5. **Discogs**, by the barcode and then the catalogue numbers MusicBrainz holds for that release
6. iTunes, searched by album title and artist
7. art already in the album folder

Discogs is never searched by title. `searchDiscogsReleasesByIdentifier` queries `barcode=` or
`catno=`. The identifiers come from a `getMusicBrainzRelease` call on the release id already in the
files' tags, so the extra request happens only when steps 2 and 3 found nothing. At most three
candidate releases are read per identifier, and the release title must match the album title once
case, punctuation and spacing are removed.

**2. iTunes must confirm the candidate with a second request.** `getItunesArtwork` now takes the
local track titles and the release year. A candidate whose title and artist match is accepted only
when one of two things is true, in this order:

- a track title from the iTunes collection matches a local track title, comparing the normalised
  title and the title with a trailing bracketed qualifier removed; or
- the iTunes release year is within one year of the year in the tags.

With neither signal available — no local titles and no year — the old single-request behaviour is
kept, so a caller that has only a title and an artist still works.

## Why MusicBrainz stays first

The owner, 2026-09-08: *"Discogs doesn't need to be the default, but it was a good fallback in this
case to confirm. That's all. MusicBrainz is typically correct."*

So Discogs did **not** move ahead of the Cover Art Archive. It sits where it does because of what it
is asked WITH: the barcode of the exact release the archive had no picture for. That is an
identifier, and it can only return the wrong album when the identifier itself is wrong. A title is
not an identifier, which is why iTunes stays below it.

## Context — the one wrong cover out of 65

The backlog run installed artwork on 65 albums. An audit of all 65 against MusicBrainz and Discogs
found 64 correct and one wrong: **Various Artists / Pulse**. MusicBrainz has the 2001 Razor & Tie
compilation, but the Cover Art Archive has no image for that release or its release group, so the
chain fell through to iTunes — which found a DIFFERENT 2024 album with the identical title and the
identical "Various Artists" credit, and its cover went on the record.

Discogs release 272692 has the correct front image for the 2001 compilation, indexed under its
barcode. Amazon's art for ASIN `B00005OBPY` agrees. Both were reachable at the moment the chain gave
up, which is what made Discogs worth adding.

## What we rejected — DO NOT revert to this

**Do not put Discogs above the Cover Art Archive, and do not make it the default matcher.** The
owner settled this in the sentence quoted above. The archive image is attached to the MusicBrainz
release id in the album's own tags and cannot belong to a different album.

**Do not search Discogs by title and artist.** That reproduces exactly the failure this change
exists to fix, on a second provider. If a release has no barcode and no catalogue number, the
provider returns nothing and the chain moves on.

**Do not make the iTunes confirmation year-only.** Measured against this library, a year-only rule
wrongly rejects three correct covers — Ahdieh (tags 2008, iTunes 2000), Sousan (2009 / 1995) and The
Foundations (2007 / 1968) — because the tag date is the rip year, not the release year.

**Do not make it tracklist-only either.** That wrongly rejects Baby Leaf, whose local titles are in
Japanese where iTunes lists the romanisation.

The two-signal rule, track overlap first and year within one year as the fallback, accepts all 16
correct iTunes covers in this library and rejects Pulse. That is why it is written that way round.

**Do not let a Discogs failure stop the chain.** Every Discogs read catches its own error and
returns null. A MusicBrainz outage, a rate limit or an unreadable release must still leave iTunes and
then the album folder their turn.

## Evidence

- `packages/core/src/tools/discogsArtwork.ts` and its tests
- `packages/core/src/tools/itunesArtwork.test.ts` — the Foundations, Baby Leaf and Pulse cases are
  real data from this audit
- `packages/core/src/music/artwork/resolveCoverArtImage.test.ts` — the chain order
- The audit itself is `docs/research/2026-09-08-cover-art-verification.md` and its `.tsv` in the
  `music-ingest` repo — one row per album, with the evidence for each verdict
