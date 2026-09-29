# 2026-09-05 — DVDCompare reads go through the provider cache, and an outage serves the stale entry

> [!WARNING]
> **SUPERSEDED IN PART on 2026-09-29 by [Every provider read is network-first, and a cache fallback is reported](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md).**
> The **seven-day time to live** is gone: DVDCompare, like every provider, is read
> network-first, and the stored entry is used only when the live request fails.
> `isStale` and the `PROVIDER CACHE STALE` warning are replaced by `isCacheFallback`
> and a `PROVIDER CACHE FALLBACK` warning that is also recorded on the job and shown
> in the Builder.
>
> Everything else here still holds: every DVDCompare read goes through the cache, the
> two mechanisms (`cachedFetch`, `cachedComputation`), the JSON envelope, the
> byte-first decoder, no cached failures, and no cap on the age of a fallback.

- **Status:** Superseded in part by [2026-09-29](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md)
- **Date:** 2026-09-05
- **Type:** core
- **Supersedes:** —
- **Superseded by:** [2026-09-29 — Every provider read is network-first, and a cache fallback is reported](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md) (the time to live and the stale-entry reporting)
- **Source:** dvdcompare.net outage on 2026-09-05; extends [2026-08-24 — Provider responses cache in SQLite](2026-08-24-provider-responses-cache-in-sqlite.md)

## Decision

Every DVDCompare read goes through `provider-cache.sqlite` under the `dvdCompare` provider
and its existing seven-day time to live. That is all four HTTP reads (`search.php`, the
releases page, the film page, the release-label lookup) **and** the headless-Chromium extras
scrape, which is keyed on the resolved film URL including the release hash.

When the cached entry has expired and the provider cannot be reached, the cache serves the
expired entry instead of failing. The outcome carries `isStale: true` and a
`PROVIDER CACHE STALE` warning names the provider, the URL and the age. This applies to
every provider, not only DVDCompare.

Two mechanisms exist because a provider read is not always one HTTP request:

| Shape | Module |
| --- | --- |
| One HTTP request | `provider-cache/cachedFetch.ts` |
| Anything else that produces a JSON-serialisable answer for a key — the browser scrape | `provider-cache/cachedComputation.ts` |

DVDCompare's HTTP entries store a small JSON envelope (`html`, `status`, `url`) rather than
the bare body. The post-redirect landing URL is load-bearing: `search.php` answers a unique
hit by redirecting to `film.php?fid=N`, and `isDirectListing` is decided from that URL. A
cache that stored only the HTML would report `isDirectListing: false` for every cached
search.

## What we rejected — DO NOT revert to this

**Declaring a provider in `PROVIDER_CACHE_TIME_TO_LIVE` and calling it cached.**
`dvdCompare: 7 * millisecondsPerDay` was there from the day the cache landed, and the
2026-08-24 decision says in as many words that the cache "covers **every** provider, not only
the music ones. DVDCompare goes down often." Nothing ever fetched through it. The only
consumer of `createCachedFetch` was `musicProviderFetchers.ts`, `searchDvdCompare.ts` called
`globalThis.fetch` directly, and the live table held rows for `discogs`, `freedbCddb`,
`musicBrainz` and `vgmdbCddb` and **zero** for `dvdCompare`. The declaration is not the
wiring. A provider is cached when a test proves a row is written and a second read does not
re-fetch.

**`Response.text()` for DVDCompare.** Its migrated legacy listings are Windows-1252 bytes
mislabelled as UTF-8, which `Response.text()` turns into U+FFFD silently. The byte-first
`decodeResponseText` fallback is why the smart quotes survive, so `createCachedFetch` takes
an injected `decodeResponseBody` rather than hard-coding `.text()`.

**Caching a failure.** Unchanged from 2026-08-24 and still absolute: a non-2xx response, a
transport error or a thrown scrape stores nothing. Stale-on-error is the opposite operation
— it *reads* an entry the provider itself returned with a 200 on an earlier day.

**Capping how stale a served entry may be.** An age limit restores exactly the hard failure
this removes: past the cap, an unreachable provider fails the run again. The cache is
disposable, so deleting `provider-cache.sqlite` is the escape hatch when an entry is wrong.

## Why it must not be re-litigated

On 2026-09-05 dvdcompare.net was unreachable and every disc ingest stopped.
`nameSpecialFeaturesDvdCompareTmdb` and `onlyNameSpecialFeaturesDvdCompare` failed with
`TypeError: fetch failed` out of `resolveUrl`, and the extras scrape failed behind them. Each
of those films had been looked up before. The answers were not on disk because the wiring was
never done, and a plain time-to-live cache would not have helped for a film last read more
than a week earlier.

The caching also removes a browser launch per re-run. A disc ingest is re-run often — to
adjust `timecodePadding`, to re-do a bucket — and each re-run was starting Chromium and
walking the release form again for an answer that had not changed.

## Context

*This section and `## Evidence` were added on 2026-09-29, when the record was superseded in
part, so that it passes the decision-record lint. Neither changes what was decided.*

The context is the 2026-09-05 outage described under the heading above.

## Evidence

The failures of `nameSpecialFeaturesDvdCompareTmdb` and `onlyNameSpecialFeaturesDvdCompare`
with `TypeError: fetch failed` on 2026-09-05, and the live table that held zero `dvdCompare`
rows, both cited above.
