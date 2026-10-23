# 2026-10-23 — SoundCloud artwork comes from oEmbed, by page URL

- **Status:** Accepted
- **Date:** 2026-10-23
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** PR `feat/soundcloud-artwork`

## Decision

SoundCloud cover art is read from the public oEmbed endpoint,
`https://soundcloud.com/oembed?format=json&url=<page>`, for a track or playlist page the
caller already knows. `getSoundCloudArtwork` (`packages/core/src/tools/soundCloudArtwork.ts`)
does not search. It is a per-song lookup and is **not** part of `resolveCoverArtImage`'s
album chain.

- The image is the `t500x500` size (`SOUNDCLOUD_ARTWORK_SIZE`).
- A thumbnail that is not an `/artworks-` image — the grey placeholder, or an uploader's
  `/avatars-` photo — gives `null`.
- With `artistName` or `trackTitle`, the match is strict normalised equality against
  `author_name` and the title, and an expected value that normalises to nothing is refused.
  The title may also match the part after a leading `"<uploader> - "`.
- A failure, a 403, or a 404 gives `null`, never a throw.
- Reads go through the provider cache as `soundCloud: NETWORK_FIRST`, with its own fetcher
  (`soundCloudCachedFetch`) at 2000 ms between requests.

## Context

A consumer needs per-song cover art for independent artists, and some of them publish only
on SoundCloud. No provider in the album chain (MusicBrainz and the Cover Art Archive,
Discogs, iTunes) holds those songs.

The SoundCloud API needs a registered client id, and SoundCloud has closed registration.

## What we rejected — DO NOT revert to this

- **Scraping the `client_id` out of SoundCloud's web bundle and calling `api-v2` with it.**
  That is the common workaround, and it uses an id issued to SoundCloud's own player, not to
  this app. The same goes for logging in, sending cookies, or sending a browser's user
  agent. This provider sends the same application user agent as every other fetcher.
- **A SoundCloud search.** There is no public search route without a client id, so a search
  would need the scraped id above. The caller supplies the page URL instead.
- **Adding SoundCloud to `resolveCoverArtImage`.** That chain finds art for an ALBUM from
  its tags by searching. With no search, SoundCloud has nothing to look up from an album's
  tags, and the song-level art it returns is not the album's cover.
- **Using the uploader's avatar when a song has no artwork.** An avatar is a photo of the
  uploader, not the release, and wrong art is worse than none (the rule the iTunes match is
  built on). It is refused rather than exposed with a flag.
- **`-original.<ext>`, `-t3000x3000`, or `-t1080x1080` as the size.** See Evidence.
- **A loose title match** (substring, or dropping any prefix before `" - "`). Only the
  uploader's own name may be dropped from the front.

## Why

oEmbed is SoundCloud's documented public embed route, needs no credentials, and answers
the one question this consumer has: "what is the cover of this page?" Keeping the lookup to
a known URL means it stays inside the terms, and a song is matched to a page a person chose,
not to a search guess.

## Evidence

Measured from this repository's sandbox on 2026-10-23.

- oEmbed for a track page returns `200` JSON with `title` written as
  `"<title> by <uploader>"`, `author_name`, and `thumbnail_url` ending `-t500x500.jpg`.
  A playlist (`/sets/`) page answers the same way. An unknown page and a non-SoundCloud
  URL both return `404`.
- A track or playlist **without** artwork returns
  `https://soundcloud.com/images/fb_placeholder.png`, not the avatar. The web page's
  `og:image` for the same track falls back to the uploader's avatar, but oEmbed does not.
  A **profile** URL returns an `/avatars-` image.
- Sizes, from one artwork with a 1400 x 1400 original and one with a 600 x 600 original:
  `-large` is 100 x 100 and `-t500x500` is 500 x 500. `-t1080x1080` and `-t3000x3000`
  always answer, but at 1080 and 3000 pixels even for the 600 x 600 original — upscaled.
  `-original` holds the true size, but its extension is the uploaded file's: of 42 tracks
  across seven artists, 29 answered only at `-original.jpg` and 13 only at
  `-original.png`. oEmbed does not say which, so the original cannot be named without an
  extra probe request.
- Recorded fixtures: `packages/core/src/tools/__fixtures__/soundcloud/`, with the source
  URLs at the top of `soundCloudArtwork.test.ts`.
