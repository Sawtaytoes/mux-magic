# DVDCompare film pages fall back to the Wayback Machine

- **Status:** Accepted
- **Date:** 2026-09-09
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —

Source: owner request, T3 Code chat 2026-09-08 through 2026-09-09. This extends
[DVDCompare reads go through the provider cache, and an outage serves the stale entry](2026-09-05-dvdcompare-reads-go-through-the-provider-cache-and-an-outage-serves-the-stale-entry.md).

## Decision

Mux-Magic reads DVDCompare live first. When a network failure prevents a film-page read and
no cached copy exists, it loads the newest successful Internet Archive capture, stores that
page under the live DVDCompare cache key, and continues. A failed live browser scrape uses the
same capture, selects only the requested release package from the archived HTML, and stores the
parsed extras under the existing release-specific scrape key.

The fetcher asks the Wayback Availability API first. If that API reports no capture, it asks the
CDX index before it reports the page as unavailable. The Availability API returned an empty
capture object for an archived *Rise of the Planet of the Apes* page while CDX returned its
2024-08-27 capture, so either endpoint alone is insufficient.

The fallback covers `film.php?fid=N` pages. It does not pretend that Wayback can replay
DVDCompare's POST-only title search. A caller can bypass that unavailable search with the
existing `dvdCompareId` and `dvdCompareReleaseHash` parameters.

## Context

On 2026-09-08 and 2026-09-09 DVDCompare's ports 80 and 443 did not answer from the owner network,
the TrueNAS host, or the agent network. The site answered with HTTP 200 through the parents'
network. The archive held 62,980 distinct film IDs and preserved the release package labels,
extras names, runtimes, and `Play All` notation needed by the naming commands.

## What we rejected — DO NOT revert to this

**A household forward proxy as the primary recovery path.** DVDCompare answers through the
parents' public address while it refuses or times out through the owner's address, so a proxy
can work. It would add another household machine, credential, tunnel, and availability
dependency to every ingest. The Internet Archive already holds the exact listings and needs no
new service. A proxy stays a later fallback if DVDCompare publishes a listing that the archive
does not yet hold.

**Caching the Wayback URL instead of the requested DVDCompare page.** That makes every future
run fail against the live URL before it discovers the separately cached archive row. The
archived body is a successful copy of that DVDCompare resource, so it belongs under the live
request key. The selected extras also remain keyed by the live film URL plus release hash.

**Treating all failures as an archive outage.** An HTML or selector regression must stay
visible. The fallback activates only for transport failures such as `fetch failed`, connection
refusal, network unreachability, timeouts, and browser `net::ERR_*` failures.

## Why

The existing SQLite cache could only serve films that had succeeded before the outage, so a cold
entry still blocked the ingest. This fallback converts the archived successful listing into that
missing first cache entry. It avoids a standing dependency on a remote household computer.

## Evidence

- `packages/core/src/tools/dvdCompareFetcher.test.ts` proves that a network failure loads an
  archived film page, stores it under the live URL, serves the second read without a request, and
  uses CDX when the Availability API omits an existing capture.
- `packages/core/src/tools/searchDvdCompare.archive.test.ts` proves that the archive parser selects
  one release package, preserves multi-disc extras and `Play All` runtimes, and caches the scrape.
- A real fetch of archived `fid=1`, release package `2`, returned 15 non-empty extras lines and the
  parsed 1979 film title.
- A live request through Lucious at the parents' address returned HTTP 200 in 10.6 seconds while
  the same URL timed out after eight seconds from the owner network.
