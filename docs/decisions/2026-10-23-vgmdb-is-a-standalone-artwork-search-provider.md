# 2026-10-23 — VGMdb is a standalone artwork search provider

- **Status:** Accepted
- **Date:** 2026-10-23
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** dispatching brief for the VGMdb and Newgrounds artwork providers, 2026-10-23; PR `feat/vgmdb-artwork`

## Decision

`packages/core/src/tools/vgmdbArtwork.ts` reads VGMdb's album search and album pages for cover
art. It exports `searchVgmdbArtworkCandidates` (every album it could read, artist matches first)
and `getVgmdbArtwork` (the first album whose title, and artist when one is given, is equal after
any-script normalization, and that has a cover). It is **not** part of `resolveCoverArtImage`'s
album chain. Its reads go through the provider cache under its own key, `vgmdb`
(`NETWORK_FIRST`), with the `vgmdbCachedFetch` limiter at one request every 3 seconds.

The provider does **not** get past VGMdb's Cloudflare challenge. A 403, a challenge body, a 404,
or a page that does not parse is "VGMdb is unavailable": `null` or `[]`, and the cache's stored
answer when it has one.

## Context

VGMdb is the reference catalog for game and anime soundtracks, and its album pages carry a cover
scan for most releases. Measured from an agent sandbox on 2026-10-23:

- every `https://vgmdb.net/*` page, including `robots.txt`, answered **403** with
  `cf-mitigated: challenge` and `server: cloudflare`, under a descriptive User-Agent and a
  browser one alike;
- the community JSON mirror `vgmdb.info` did not answer at all;
- VGMdb has no official API. The freedb emulator behind the `vgmdbCddb` key is not challenged,
  but it matches a disc by its table of contents, not by title, so it cannot serve a search;
- the image host `media.vgm.io` answered 200 to the full-size path.

So the page structure was learned from the Internet Archive's original-bytes copies
(`https://web.archive.org/web/<timestamp>id_/<url>`), and the test fixtures are those copies,
trimmed. Each archive URL and timestamp is listed at the top of `vgmdbArtwork.test.ts`.

What the archived pages show:

- the cover is a CSS background on `#coverart`, and `og:image` repeats it. Both point at
  `medium-media.vgm.io`, the 250 pixel image. `media.vgm.io` serves the same path at full size,
  so the provider rewrites the host;
- each title is a `span.albumtitle` per language (English, Japanese, and its romanization), on
  the search row and in the album page's `h1`;
- the credits are free-text roles in `#collapse_credits`, with linked artists that carry an
  English and a Japanese name, and plain comma-separated names for people with no artist page;
- a search with one result redirects to the album page, so a search body can be an album page.

## What we rejected — DO NOT revert to this

- **Getting past the challenge.** No challenge solver, no headless browser to run the challenge
  script, no borrowed browser User-Agent, no proxy, no login cookie, and no other machine. The
  challenge is VGMdb saying no to automated clients; the provider respects it.
- **Joining the album chain.** A title search can find a different album of the same name, and
  wrong art is worse than none. The chain stays identifier-first, with iTunes as its only title
  search. A caller that wants VGMdb offers its candidates to a person or applies the strict
  match explicitly.
- **Reusing the `vgmdbCddb` key.** The web pages are a different surface with a different
  politeness interval. The provider-cache test names `vgmdb` beside `vgmdbCddb` on purpose.
- **Putting the artist in the search query.** VGMdb's album search matches words against album
  titles and catalog numbers, so a composer's name in the query would remove the album being
  looked for. The artist is checked against the album page's musical credits instead.
- **Every credited name as an artist.** An album page credits its mastering engineer, designer,
  and promoters. Only the writing, performing, and instrument roles count, so an engineer's name
  never matches an album.
- **Keeping the `-medium` image.** It is a 250 pixel preview, and the rule for every provider
  here is the original image.

## Why

A soundtrack missing from MusicBrainz, Discogs, and iTunes is often on VGMdb, so the provider is
worth having for the day VGMdb answers this client. Until then it costs one refused request per
search and returns nothing, and it never throws into a caller.

## Evidence

- `curl -D - https://vgmdb.net/robots.txt` on 2026-10-23: `HTTP/2 403`, `cf-mitigated: challenge`,
  `server: cloudflare`, body titled `Just a moment...`. The trimmed body is the fixture
  `cloudflare-challenge-403.html`.
- `curl -I https://media.vgm.io/albums/97/79/79-1264618929.png` on 2026-10-23: `200 image/png`.
- Archived copies used: one album search page and three album pages, each listed with its archive
  URL and timestamp at the top of `vgmdbArtwork.test.ts`.
