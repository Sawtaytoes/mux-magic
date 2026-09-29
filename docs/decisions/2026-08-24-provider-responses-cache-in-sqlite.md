# 2026-08-24 — Provider responses cache in SQLite, and the cache is disposable

> [!WARNING]
> **SUPERSEDED IN PART on 2026-09-29 by [Every provider read is network-first, and a cache fallback is reported](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md).**
> The **per-provider time to live** below is gone: every provider is now read
> network-first, and a stored answer is used only when the live request fails.
> AniDB alone keeps a one-day no-request window. Do NOT reintroduce a time to live
> that serves without asking.
>
> Everything else here still holds: one SQLite table, `node:sqlite`, keyed by
> `(provider, requestKey)`; the cache covers every provider; it is disposable; no
> library catalog; a failure is never cached.

- **Status:** Superseded in part by [2026-09-29](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md)
- **Date:** 2026-08-24
- **Type:** core
- **Supersedes:** —
- **Superseded by:** [2026-09-29 — Every provider read is network-first, and a cache fallback is reported](2026-09-29-every-provider-read-is-network-first-and-a-cache-fallback-is-reported.md) (the per-provider time to live only)
- **Source:** owner decision, chat 2026-08-24; plan `docs/music-tagging-plan.md` §3

## Decision

Mux-Magic caches external provider responses in one SQLite database, `provider-cache.sqlite`, next to the template store. It uses `node:sqlite`, which is built into Node 26 — no new npm package. One table keyed by `(provider, requestKey)` holds the raw response body, a fetch timestamp and an ETag. Each provider has its own time-to-live.

The cache covers **every** provider, not only the music ones. DVDCompare goes down often. AniDB rate-limits and dislikes repeat requests for the same show. MusicBrainz asks for one request per second. VGMdb has no official API, so every lookup is a scrape.

**The cache is disposable.** Nothing in it is a book of record. Deleting the file may cost time and may cost nothing else. If the database cannot be opened, the module degrades to "no cache" and passes every request through. It never throws and it never blocks a job.

## What we rejected — DO NOT revert to this

**A JSON file on disk.** That is how the template store, the job store and the job-error store all persist, so it is the pattern an agent will drift back toward. It does not work here: a provider cache holds thousands of rows of raw response bodies, it is read on a hot path, and it needs per-row expiry. `templateStore.ts` says "no sqlite" in a comment — that comment is about a 50-template flat file under 1 MB, and it is not a rule about this repo.

**A library catalog.** This is a cache. It must never hold the state of the music library. Music Assistant and Plex already index that library and Mux-Magic reads them read-only. A second index that can disagree with the first two is the thing this decision refuses.

**Caching a failure.** A non-2xx response is never stored. Only a 200 body, or a 304 that refreshes an existing row's timestamp.

## Why it must not be re-litigated

Before this, every DVDCompare outage failed a run outright, and every re-run of the same album hit AniDB and MusicBrainz again. The one-request-per-second MusicBrainz limit is enforced by IP ban, and the address it would ban is the household's — a cache is the normal way to stay inside that limit, not an optimisation.

The disposability clause is the part that keeps this safe. Because deleting the file costs only time, the cache never needs a migration, a backup or a repair tool. Any change that puts data of record in here breaks that, and then the file needs all three.

## Context

*This section and `## Evidence` were added on 2026-09-29, when the record was superseded in
part, so that it passes the decision-record lint. Neither changes what was decided.*

The context is the one given under the heading above: DVDCompare outages failed runs
outright, and every re-run of an album asked AniDB and MusicBrainz again.

## Evidence

The owner's decision in the 2026-08-24 chat, and `docs/music-tagging-plan.md` §3, as named
in the `Source` line.
