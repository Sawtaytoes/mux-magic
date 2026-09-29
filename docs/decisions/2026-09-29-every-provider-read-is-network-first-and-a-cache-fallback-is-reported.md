# 2026-09-29 — Every provider read is network-first, and a cache fallback is reported

- **Status:** Accepted
- **Date:** 2026-09-29
- **Type:** core | server/api | web
- **Supersedes:** [2026-08-24 — Provider responses cache in SQLite](2026-08-24-provider-responses-cache-in-sqlite.md) (the per-provider time to live only); [2026-09-05 — DVDCompare reads go through the provider cache, and an outage serves the stale entry](2026-09-05-dvdcompare-reads-go-through-the-provider-cache-and-an-outage-serves-the-stale-entry.md) (the seven-day time to live, `isStale` and the `PROVIDER CACHE STALE` warning)
- **Superseded by:** —
- **Source:** owner, T3 Code chat 2026-09-29 (relayed in the dispatching brief); PR `network-first-provider-cache`

## Decision

Every read from an outside provider goes through `provider-cache.sqlite` and is
**network-first**. The provider is asked on every read. A success (or a 304) is stored and
returned. The stored answer, at any age, is used **only** when that request fails — a
transport error, a timeout, a non-2xx status, or a scrape that throws. With nothing stored,
the read fails as it did before.

**AniDB is the one exception.** An AniDB answer younger than 24 hours is served with no
request, because AniDB bans a client that asks for the same anime twice in a day. Past 24
hours AniDB is network-first like the rest. The window lives in `PROVIDER_CACHE_POLICIES`
(`providerCache.ts`); every other provider there is `NETWORK_FIRST`.

**Every fallback is reported.** `reportProviderCacheFallback` writes a
`PROVIDER CACHE FALLBACK` warning that names the provider, the request, the age of the stored
copy and the cause. During a job it is also recorded on the job and its umbrella
(`Job.providerCacheFallbacks`), pushed as a `provider-cache-fallback` SSE event, replayed on
reconnect, and carried on the done frame. The Builder's run modal and the Jobs page show it as
a warning `ProviderCacheFallbackNotice` (Charcuterie `Alert`).

**Every request is bounded.** `cachedFetch` takes a timeout (20 s default; TMDB keeps its
10 s, MusicBrainz 15 s, AniDB and DVDCompare 20 s) and `cachedComputation` bounds a whole
scrape (120 s default, MyAnimeList 60 s). A timeout is a failure like any other, so it falls
back. The uncached requests are bounded too.

**A per-job circuit.** Once a provider is *unreachable* in a run — a transport error, a
timeout, a 5xx/429 after the retries, an AniDB ban — the rest of that run reads the stored
answer without asking again, and the fallback says so (`isProviderSkipped`). The circuit is
scoped to the root job, so a sequence's steps share one. It reopens for a probe after two
minutes. A 404 or a parse failure does not open it. A read outside any job (a Builder lookup)
has no circuit, so a retry always reaches the provider.

The provider-table key type is the `provider` parameter of `createCachedFetch` and
`createCachedComputation`, so a fetcher registered under a name the table lacks does not
compile.

### What each call site does now

| Call site | Provider key | Before | Now |
| --- | --- | --- | --- |
| MusicBrainz, AcoustID lookup, Discogs, iTunes, FreeDB, VGMdb (`musicProviderFetchers.ts`) | `musicBrainz` … `vgmdbCddb` | cached, 1–30 day TTL | network-first |
| MusicBrainz reads in `applyCoverArt` | `musicBrainz` | **uncached** (`rateLimitedMusicBrainzFetch`) | network-first; the uncached fetcher is deleted |
| Cover Art Archive JSON | `coverArtArchive` | **uncached** (the cached fetcher was declared and never used) | network-first |
| DVDCompare HTTP reads + extras scrape | `dvdCompare` | cached, 7 day TTL, stale on error | network-first; https → http twin is part of the live request; Wayback only when nothing is stored |
| TMDB search + lookup | `movieDb` | **uncached**, 10 s timeout | network-first, 10 s kept |
| TheTVDB (openapi-fetch) | `tvdb` | **uncached** | network-first through a `fetch` adapter |
| Jikan (MyAnimeList API) | `jikan` | **uncached** | network-first |
| `mal-scraper` (MyAnimeList pages, axios) | `myAnimeList` | **uncached** | network-first scrape, 60 s bound |
| Criterion forum UHD post (Chromium) | `criterionForum` | **uncached** | network-first; raw post HTML stored, parsed after |
| AniDB HTTP API | `aniDb` | own 7-day XML directory | in `provider-cache.sqlite`; 24 h no-request window, then network-first |
| AnimeThemes API | `animeThemes` | own 30-day JSON directory | network-first |
| manami anime-offline-database | — (a 61 MB file) | re-downloaded after 7 days | stays a file; HEAD version check on every load, download only on change, the file is the reported fallback |
| MusicBrainz / AcoustID submissions, MusicBrainz OAuth token | — | no timeout | writes and a credential: never cached; now bounded (30 s) |
| Music Assistant album search | — | no timeout | the household's own library, never cached (2026-08-24: no catalog); now bounded (20 s) |
| TVDB login, theme audio download, cover-art image download, webhook + error delivery | — | — | not cached (a credential, binary media, writes); all bounded |
| Web `<img>` posters, dev scripts (`screenshots.ts`, `generateExternalApiSchemas.ts`) | — | — | out of scope: browser-side or not the running app |

## Context

The 2026-08-24 cache served a stored answer without asking while it was younger than its
provider's time to live, so a changed DVDCompare listing or a new MusicBrainz edit stayed
invisible for up to 30 days. At the same time half the outbound reads never went through it —
TMDB, TheTVDB, Jikan, MyAnimeList, the Criterion forum, the MusicBrainz reads in
`applyCoverArt` and the Cover Art Archive — so an outage of any of those still failed the
run. AniDB and AnimeThemes each kept a private disk cache the owner could not see into, and
nothing told the owner when a result had been built from stored data.

## What we rejected — DO NOT revert to this

**A time-to-live that serves without asking.** It is the thing this record removes: the owner
wants the latest every time. The only window is AniDB's, and it exists because of a ban rule,
not for speed. Do not add a window for any other provider without a documented
ban-for-repeat rule of the same kind — bring that to the owner rather than deciding it.

**Silent fallback.** Serving a stored answer without saying so is how a stale DVDCompare
listing names a file wrong and nobody knows why. A fallback always logs, and during a job it
always lands on the job.

**A process-wide circuit.** In the server one failed Builder lookup would make every later
lookup fail instantly for two minutes, including the retry the user presses because it
failed. The circuit is per root job; outside a job there is none.

**No circuit at all.** A 30-release MusicBrainz match against a provider that has gone quiet
would wait out 30 timeouts of 15 s each (7.5 minutes) before finishing on cached answers it
could have served at once. For
AniDB, asking a banning server again is how the ban gets longer.

**Charcuterie's `createHttpCache` cooldown, adopted in this change.** Its
`unavailableCooldownMs` is process-wide and *delays* every request to the origin; it has no
job scope and no fallback report. Moving the cache onto it is still the open option in
`docs/agents/outbound-http-cache.md`, and the per-scope circuit and the report hook are the
two shapes it would need first.

**Keeping AniDB's own XML directory.** One cache, one table, one fallback path, one
report. The old files are imported on first read with their file time, so the 24-hour
no-repeat rule holds across the upgrade and no answer is thrown away.

**Moving the manami dataset into SQLite.** It is one 61 MB bulk file with its own version
check, not a keyed response. It stays a file, but it is network-first now: the version is
checked on every load, and the file is the reported fallback.

**Caching a failure, capping how stale a fallback may be, or making the cache a book of
record.** Unchanged from 2026-08-24 and 2026-09-05.

## Why

The owner's rule is "fetch the latest, use the cache only when the server is down, and tell
me." Network-first gets the first half; the circuit keeps a dead provider from costing a
timeout per request; the report and the notice get the second half. Folding the private caches
in means one place to clear and one policy to read.

## Evidence

- Owner, 2026-09-29: "We should definitely cache that stuff too. We should be caching all
  these requests with Mux-Magic in case servers go down. We can always ensure we're grabbing
  the latest if it exists and relying on the cache only if it doesn't. We can inform the user
  it will be using cached values as well." On AniDB he chose the "One-day exception".
- The audit (`rg -uu` over `packages/`) found TMDB, TheTVDB, Jikan, `mal-scraper`, the
  Criterion forum scrape, `applyCoverArt`'s MusicBrainz reads and the Cover Art Archive
  outside the cache, and a dead `vgmdb` key in the old table beside the registered
  `vgmdbCddb`.
- Tests: `cachedFetch.test.ts` (network-first with a stored row, fallback + report, no row
  fails, AniDB 23 h no request / 25 h request, timeout fallback, circuit skip / probe / per
  job / 404 does not open it, `@ts-expect-error` on an unregistered provider),
  `anidbApi.test.ts` (legacy import), `searchMovieDb.test.ts` (TMDB cached, 10 s kept),
  `providerCacheFallbackBridge.test.ts`, `logRoutes.test.ts`.
