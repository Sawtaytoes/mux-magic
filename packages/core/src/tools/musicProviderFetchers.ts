import { createCachedFetch } from "../provider-cache/cachedFetch.js"
import { ACOUSTID_MINIMUM_REQUEST_INTERVAL_MILLISECONDS } from "./acoustIdApi.js"
import { ITUNES_MINIMUM_REQUEST_INTERVAL_MILLISECONDS } from "./itunesArtwork.js"
import {
  type CachedFetch,
  MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  requireMusicBrainzUserAgent,
} from "./musicBrainzApi.js"
import {
  getSharedProviderCache,
  registerProviderCacheResetHandler,
} from "./sharedProviderCache.js"

// The Cover Art Archive is a redirector in front of the Internet Archive and
// asks for no particular rate. MusicBrainz allows one request per second and
// enforces it by blocking the address, so it keeps its own interval.
const COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 200

const fetcherCache = new Map<string, CachedFetch>()

registerProviderCacheResetHandler(() => {
  fetcherCache.clear()
})

// Built once per provider and reused. Building it per request would create a
// new rate limiter every time, which defeats the interval entirely.
const getFetcher = ({
  minimumRequestIntervalMilliseconds,
  provider,
}: {
  minimumRequestIntervalMilliseconds: number
  provider: string
}) =>
  fetcherCache.get(provider) ??
  (fetcherCache
    .set(
      provider,
      createCachedFetch({
        cache: getSharedProviderCache(),
        minimumRequestIntervalMilliseconds,
        provider,
        userAgent: requireMusicBrainzUserAgent(),
      }),
    )
    .get(provider) as CachedFetch)

const buildFetcher =
  (options: {
    minimumRequestIntervalMilliseconds: number
    provider: string
  }): CachedFetch =>
  (url, init) =>
    getFetcher(options)(url, init)

export const musicBrainzCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "musicBrainz",
})

export const acoustIdCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    ACOUSTID_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "acoustId",
})

// VGMdb's own freedb emulator. It sets no rate limit anywhere, so this
// is a politeness number rather than a published one — one album is two
// requests, and a library pass should not read like a flood.
export const vgmdbCddbCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds: 500,
  provider: "vgmdbCddb",
})

// General freedb, the fourth fallback. Its own limiter, so a freedb pass
// cannot eat VGMdb's interval or the other way round.
export const freedbCddbCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds: 500,
  provider: "freedbCddb",
})

// Anonymous Discogs clients receive 25 requests per minute. The full release
// fetches share this limiter with search requests, so a library pass stays
// below that published limit without requiring a personal access token.
export const discogsCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds: 2_500,
  provider: "discogs",
})

export const coverArtCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "coverArtArchive",
})

// Apple publishes no rate limit and throttles the search endpoint at roughly
// 20 calls a minute, so this is a politeness number rather than a published
// one. Its own limiter, so an artwork pass cannot eat the Cover Art
// Archive's interval or the other way round.
export const itunesCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    ITUNES_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "itunes",
})

// Re-exported so the existing import path keeps working; the holder and
// the close itself now live in sharedProviderCache.ts, which the
// DVDCompare fetcher shares.
export { closeSharedProviderCache } from "./sharedProviderCache.js"
