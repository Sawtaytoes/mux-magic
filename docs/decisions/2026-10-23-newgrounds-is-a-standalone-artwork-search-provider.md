# 2026-10-23 — Newgrounds is a standalone artwork search provider

- **Status:** Accepted
- **Date:** 2026-10-23
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** dispatching brief for the VGMdb and Newgrounds artwork providers, 2026-10-23; PR `feat/newgrounds-artwork`

## Decision

`packages/core/src/tools/newgroundsArtwork.ts` reads Newgrounds' audio search and listen pages
for a track's art. It exports `searchNewgroundsArtworkCandidates` (every track it could read,
author-and-title matches first) and `getNewgroundsArtwork` (the track whose author and title
are both equal after any-script normalization, and that has an image). It is **not** part of
`resolveCoverArtImage`'s album chain. Its reads go through the provider cache under its own key,
`newgrounds` (`NETWORK_FIRST`), with the `newgroundsCachedFetch` limiter at one request every
3 seconds.

Every candidate carries `isArtistIcon`. It is `true` when the image is the author's user icon
rather than art made for the track. That happens when the page's `og:image` is a user icon, and
when the track has no art of its own: the provider then offers the credited author's icon and
flags it. A caller must not treat a flagged image as a cover without saying so.

The provider does **not** get past Newgrounds' browser check. A 403, a guard page, a 404, or a
page that does not parse is "Newgrounds is unavailable": `null` or `[]`, and the cache's stored
answer when it has one.

## Context

Measured from an agent sandbox on 2026-10-23: every `https://www.newgrounds.com/*` page,
including `robots.txt`, answered **403**. The body is not Cloudflare's. It is Newgrounds' own
"NG Guard" page, which runs a JavaScript puzzle and says that logged-in members skip the check.
Newgrounds publishes no API for audio search.

So the page structure was learned from the Internet Archive's original-bytes copies
(`https://web.archive.org/web/<timestamp>id_/<url>`), and the test fixtures are those copies,
trimmed. Each archive URL and timestamp is listed at the top of `newgroundsArtwork.test.ts`.

What the archived pages show:

- a search row is `a.item-audiosubmission` with the title in `.detail-title h4` and the author
  in `.detail-title strong`. Older result pages carry no `title` attribute;
- a listen page's art is its `og:image`. Track art lives on `aicon.ngfiles.com`, as a
  `_full.webp` on newer pages and a plain `.png` on older ones;
- a track with no art of its own shows the generic icon from `img.ngfiles.com/defaults/`, or no
  `og:image` at all. Users' icons live on `uimg.ngfiles.com/icons/` and appear in the page's
  "Credits & Info" block;
- older uploads put the author in front of the title, as in `<author> - <title>`.

## What we rejected — DO NOT revert to this

- **Getting past NG Guard.** No puzzle solver, no headless browser to run the check, no borrowed
  browser User-Agent, no proxy, no login cookie, and no other machine. The guard is Newgrounds
  saying no to automated clients; the provider respects it.
- **Joining the album chain.** Newgrounds is a track site, many uploads share a title, and its
  art is often an avatar. Wrong art is worse than none.
- **Returning a user icon as if it were track art.** The icon is offered only with
  `isArtistIcon: true`, and `getNewgroundsArtwork` prefers a track's own art to an icon.
- **A loose title match.** The one tolerance is the uploader's own name as a `<author> - `
  prefix. Any other difference, such as a remix tag, refuses the match.
- **Putting the author in the search query.** The search is on the track title. The author is
  compared with each result's credited uploader, and a non-matching result's page is never
  opened.

## Why

A track that exists only on Newgrounds has no other source of art, so the provider is worth
having for the day Newgrounds answers this client. Until then it costs one refused request per
search and returns nothing, and it never throws into a caller.

## Evidence

- `curl -D - https://www.newgrounds.com/robots.txt` on 2026-10-23: `HTTP/2 403`. The search page
  returned the same status with a body titled `NG Guard`, recorded as the fixture
  `ng-guard-403.html`.
- Archived copies used: two audio search pages and two listen pages, each listed with its archive
  URL and timestamp at the top of `newgroundsArtwork.test.ts`. Two further archived listen pages
  of tracks without their own art were read to learn the no-art shapes and were not kept as
  fixtures; the tests derive those shapes from a kept page instead.
