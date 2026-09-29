# The provider cache, and the Charcuterie library that could own its policy

**Since 2026-09-29 every provider read is network-first and goes through one cache.** The
rule and the call-site table are in
[the decision](../decisions/2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md).
This page is the map for changing it, and the option of moving its policy onto Charcuterie.

## What this repo does today

| Part | Where |
| --- | --- |
| One SQLite table, `(provider, requestKey)` → body, ETag, `fetchedAt` | `provider-cache/providerCache.ts` |
| The provider table — `NETWORK_FIRST` for all, a one-day window for `aniDb` only. Its key type is the `provider` parameter, so an unlisted provider does not compile | `PROVIDER_CACHE_POLICIES` |
| One HTTP request, network-first, with a timeout, retries on 429/503, If-None-Match | `provider-cache/cachedFetch.ts` |
| Anything else that yields a JSON value for a key — a Chromium scrape, `mal-scraper` — bounded as a whole | `provider-cache/cachedComputation.ts` |
| The shared resolution: fresh window → live request → stored row → last resort (DVDCompare's Wayback) → fail | `provider-cache/networkFirst.ts` |
| The per-job circuit (root job scope, 2 min cooldown, then a probe; none outside a job) | `provider-cache/providerCircuitBreaker.ts` |
| The fallback report: the `PROVIDER CACHE FALLBACK` log line, then the listeners | `provider-cache/providerCacheFallbacks.ts` |
| The listener that records a fallback on the job and its umbrella + the SSE event | `api/providerCacheFallbackBridge.ts`, `jobStore.recordProviderCacheFallback` |
| The shared, lazily opened fetchers a provider module declares at import | `tools/sharedProviderFetchers.ts`, `tools/musicProviderFetchers.ts` |

AniDB keeps what made its old module right:

| Part | Where |
| --- | --- |
| `MIN_REQUEST_INTERVAL_MS = 2_500` — AniDB publishes 1 request per 2 s, padded by 0.5 s | `anidbApi.ts` → the fetcher's rate limiter |
| A **promise chain**, not a timestamp check, so N concurrent callers space out like N sequential ones | `provider-cache/rateLimiter.ts` |
| Single-flight by `aid`, so two lookups of one anime are one request | `inFlightByAid` |
| An `<error>` body is a failure, never stored; a ban also opens the circuit | `decodeAnidbResponse` |
| The pre-2026-09-29 `<ANIDB_CACHE_FOLDER>/anime/<aid>.xml` files, imported once with their file time | `importLegacyAnimeXml` |

The comments explaining *why* the throttle is a chain and not a bare `Date.now()` comparison
are still the most valuable lines here — a bare check lets a parallel sequence group burst
past the cap and earn a ban.

**Adding a provider:** add its key to `PROVIDER_CACHE_POLICIES` as `NETWORK_FIRST`, declare
its fetcher with `buildSharedCachedFetch` / `buildSharedCachedComputation`, and give it a
timeout. A no-request window needs a documented ban-for-repeat rule and the owner's
agreement — see the decision.

## What `@charcuterie/server/http` would give it

The library shipped this in **0.4.0** (`createHttpCache`, `createThrottle`, `lifetime`). It
owns the **policy** and never the store, so `provider-cache.sqlite` would stay exactly where
it is and become a `{ read, write }` adapter.

- The provider table's fresh window becomes a `lifetime`.
- `minimumRequestIntervalMilliseconds` becomes `minIntervalMs`, and the library's queue
  replaces `rateLimiter.ts`.
- `inFlightByAid` is already what the library does per key — a **deletion**, not a gain.
- **Its `unavailableCooldownMs` is NOT a drop-in for the circuit here.** It is process-wide
  and it *delays* every request to the origin. This repo needs the circuit scoped to a job
  (so a Builder retry is never refused because an earlier lookup failed) and needs it to
  serve the stored answer at once, with a report. Those two shapes — a scope resolver and a
  fallback hook — belong in Charcuterie first, before an adoption here.

An `"unavailable"` outcome — a socket error, a 5xx, a spent budget — is **never cached**.
Caching one unreachable minute is how a week goes by with no metadata.

## Before adopting

- This is a **CLI as well as a server**. The stored answer, not the in-process throttle, is
  what protects AniDB across separate invocations, so the store adapter must keep writing
  `provider-cache.sqlite`.
- Read the workspace runbook first — it carries the measured numbers from the one app that
  has adopted, and the two traps that cost that adoption a false-pass deploy:
  `agentic/docs/runbooks/charcuterie-server-http-cache-adoption.md`.
- ⚠️ **A caret on a `0.x` version pins the MINOR.** Bump every workspace package that names
  `@charcuterie/server` in the same change, or Yarn installs two copies and nothing goes red.
