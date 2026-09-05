# 2026-09-05 — Mux Magic writes cover art, and iTunes joins the provider chain

- **Status:** Accepted
- **Date decided:** 2026-09-05
- **Area:** core / api / web
- **Source:** chat `t3code-45f549d9`; the SpeedRunners 2 soundtrack ingest that landed with a blank album

## Decision

Mux Magic writes album cover art. `applyCoverArt` takes one album folder, resolves an image, writes
`cover.<ext>` beside the files, and embeds exactly one front picture in every audio file.

The picture is written with `node-taglib-sharp` — the same library the tag writer uses — by assigning
a one-element `tag.pictures` array. The audio is never re-encoded and never remuxed.

The provider chain is, in order:

1. an explicit image URL the caller gave
2. the Cover Art Archive, by MusicBrainz release id
3. the Cover Art Archive, by MusicBrainz release group id
4. **iTunes**, searched by album title and artist
5. art already in the album folder

Steps 2, 3 and 5 are Picard's chain from `docs/picard-parity.md` §2, with local files last exactly as
Picard has them. **Step 4 is new and is NOT Picard behaviour.** It is here because the Cover Art
Archive knew only 37 of the 333 albums in this library that had no artwork at all, and iTunes knows
another 35. TheAudioDB stays the unimplemented seam it already was.

The MusicBrainz release ids and the album title and artist all come from the files' own tags, so the
command runs on a folder path alone.

## What we rejected — DO NOT revert to this

**Do not go back to `AudioTags` being the only way to change a music file.** That type is text-only,
its 20 fields have no picture among them, and `diffAudioTags` compares strings. Cover art was left out
of it on purpose. Adding a base64 blob field to `AudioTags` to "make artwork just another tag" would
put a multi-megabyte value through a differ built for strings and through every tag-table row that
renders one.

**Do not embed artwork by shelling out to ffmpeg.** The first fix for the SpeedRunners album did that
by hand — `ffmpeg -c:a copy` with an `attached_pic` disposition — and it works, but it rewrites the
whole container, silently drops tags the FLAC muxer does not carry (the per-file REAPER
`CREATION_TIME` had to be re-applied by hand), and needs a decoded-audio MD5 comparison afterwards to
prove nothing moved. taglib edits the metadata block in place, so none of that applies.

**Do not loosen the iTunes match.** It is a text search over a public catalogue, so a loose match puts
the WRONG album cover on a record, which is worse than leaving it blank and much harder to notice
later. The album title and the artist must both be equal once case, punctuation and spacing are
removed. A prefix match, a fuzzy score or a "first result wins" rule is a regression, not a
convenience.

**Do not overwrite art the folder already has.** `saveCoverArtFile` refuses when
`LOCAL_COVER_ART_PATTERN` matches anything — `cover.*`, `folder.*`, `albumart*.*`. A folder where
somebody already chose a cover keeps the one they chose. This is what makes the command safe to run
across a whole library.

## Why it must not be re-litigated

A verified ingest reported success on 2026-09-04 with no artwork installed and no mention of artwork,
and the owner found the blank album in Plex the next day. The cause was not the missing MusicBrainz
release everyone looked at first — it was that no code path in this app could write a picture at all.
A library scan the same day found 333 album folders of 3627 with no artwork in any form.

The owner's rule is now recorded in the `music-ingest` repo: an album ingest is not finished until the
album has artwork, in both forms — a file in the folder and an embedded picture per track.
