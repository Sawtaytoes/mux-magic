# 2026-10-23 — Bandcamp artwork reads the artist's own pages, not search

- **Status:** Accepted
- **Date:** 2026-10-23
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** dispatching brief, 2026-10-23; PR `feat/bandcamp-artwork`

## Decision

`packages/core/src/tools/bandcampArtwork.ts` is a **standalone, strict-match** artwork
provider for per-song and per-album cover art from Bandcamp. The caller supplies the
artist's Bandcamp page URL — an identifier, such as a MusicBrainz artist's `bandcamp` URL
relation. The provider reads only that artist's own pages: `/music`, the artist root, and
the album and track pages the discography links to. It never calls Bandcamp search or any
`/api/` route.

- `listBandcampArtistReleases({ artistPageUrl, cachedFetch })` lists every release on the
  discography, unfiltered, so a caller can put near-misses on a review list.
- `getBandcampArtwork({ artistPageUrl, albumTitle?, trackTitle?, cachedFetch })` accepts a
  release only when a title is **equal** after the any-script normaliser
  (`normaliseTitleForIdentifierMatch`). An empty normalised title is refused. A track title
  that no single matches is looked for in the artist's album track lists, at most
  `BANDCAMP_MAXIMUM_ALBUM_PAGES_PER_LOOKUP` (20) album pages per call, and that album's cover
  is returned. A failure, a refusal, a 403, or a 404 is `null`, never a throw.
- **robots.txt is honored per host.** Each lookup first reads `<host>/robots.txt` through the
  cached fetcher and refuses any path that a `User-agent: *` rule disallows (`robotsTxt.ts`,
  RFC 9309 matching). A missing robots.txt (4xx) restricts nothing; an unreadable one (5xx,
  429, network error) refuses the whole host. Only the artist's own host is read. `/api/` and
  `/search` are also refused in code, whatever robots.txt says later.
- The image is the **original upload**: the `f4.bcbits.com/img/a<art id>_<n>.jpg` size
  suffix is rewritten to `_0` (`BANDCAMP_ARTWORK_SIZE_SUFFIX`).
- The provider cache key is `bandcamp`, `NETWORK_FIRST` like every other provider.
  `bandcampCachedFetch` waits at least 3000 ms between requests — a politeness number,
  because Bandcamp publishes no API and no rate limit. It sends mux-magic's own descriptive
  User-Agent; no login, no cookies, no browser User-Agent.
- Bandcamp is **not** part of `resolveCoverArtImage`'s album chain. Adding it there would
  change how library albums are tagged and needs its own decision.

## Context

A consumer needs per-song cover art for independent and chiptune artists, many of whom
publish only on Bandcamp. The first design searched `https://bandcamp.com/search`. Before
any code was written, Bandcamp's robots.txt was read, and it disallows that path for every
generic agent. The search design was dropped, and this one replaced it.

## What we rejected — DO NOT revert to this

- **Bandcamp search** (`/search?q=…&item_type=a|t`). robots.txt disallows it for
  `User-agent: *`. Do not add it back, and do not reach the same data through `/api/`,
  which is disallowed too.
- **A hidden or undocumented API, a login, cookies, or a browser User-Agent.** The provider
  reads public pages as mux-magic and nothing else.
- **A loose title match** (substring, "close enough", dropping a bracketed qualifier). A
  wrong cover is worse than none; the near-miss belongs on the caller's review list from
  `listBandcampArtistReleases`.
- **Joining the album chain silently.** See the Decision.

## Why

Search was the convenient route, and the site owner has asked generic clients not to use
it. The artist's own pages are allowed, and the caller already knows the artist from an
identifier, so the search is not needed to find the right page. Reading robots.txt on every
lookup keeps the provider honest if Bandcamp changes the file. The strict match and the
`null`-on-failure contract are the same as the iTunes and Discogs providers.

**The ClaudeBot line.** The same robots.txt disallows the `ClaudeBot` user agent
site-wide (`User-agent: ClaudeBot` / `Disallow: /`), with GPTBot, CCBot, and other
crawlers. That line addresses a crawler that walks the site to collect training data. This
provider is not a crawler: it fetches a handful of one artist's pages per caller request,
spaced at least three seconds apart, under mux-magic's own User-Agent, and it obeys the
`User-agent: *` group that applies to it. The fixtures were recorded the same way: a few
single requests to public pages, by hand.

## Evidence

robots.txt, read 2026-10-23 from `https://bandcamp.com/robots.txt` (artist subdomains such
as `https://carpenterbrut.bandcamp.com/robots.txt` serve the same rules, plus a `Sitemap:`
line):

```text
User-agent: *
Disallow: /tools
Disallow: /checkout
Disallow: /download_check
Disallow: /cart/
Disallow: /corpbanner/
Disallow: /stream
Disallow: /api/
Disallow: /design_tokens
Disallow: /search

Allow: /api/currency_data/
…
User-agent: ClaudeBot
Disallow: /
```

Image size suffix, measured 2026-10-23 on `f4.bcbits.com`:

| Suffix | Cover A (`a2625956694`) | Cover B (`a2304079740`) |
| --- | --- | --- |
| `_0` | 1500 x 1500, 1.99 MB | 640 x 640, 440 KB |
| `_10` | 1200 x 1200, 499 KB | 640 x 640, 195 KB |
| `_5`, `_16` | — | 700 x 700 (upscaled) |
| `_2` (grid thumbnail) | — | 350 x 350 |

`_0` is the upload itself, so it can be a PNG behind a `.jpg` name (`a0196899490_0.jpg`
came back `image/png`).

Page shapes, observed 2026-10-23: `/music` and the root carry the grid as
`<ol id="music-grid">` with `<li>` items and a `data-client-items` JSON attribute for the
rest; an artist with one release answers `/music` and `/` with a 303 to that release's
page; an album or track page carries `data-tralbum` JSON with `item_type`, `url`, `art_id`,
and `trackinfo[].title`. The recorded fixtures are in
`packages/core/src/tools/__fixtures__/bandcamp/`.
