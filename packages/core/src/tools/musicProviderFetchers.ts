import { createCachedFetch } from "../provider-cache/cachedFetch.js"
import {
  openProviderCache,
  providerCacheDatabasePath,
} from "../provider-cache/providerCache.js"
import {
  MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  requireMusicBrainzUserAgent,
  type CachedFetch,
} from "./musicBrainzApi.js"

// The Cover Art Archive is a redirector in front of the Internet Archive and
// asks for no particular rate. MusicBrainz allows one request per second and
// enforces it by blocking the address, so it keeps its own interval.
const COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 200

const cacheHandle = {
  instance: null as ReturnType<
    typeof openProviderCache
  > | null,
}

const fetcherCache = new Map<string, CachedFetch>()

const getSharedProviderCache = () =>
  cacheHandle.instance ??
  (cacheHandle.instance = openProviderCache({
    databasePath: providerCacheDatabasePath,
  }))

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

export const coverArtCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "coverArtArchive",
})

export const closeSharedProviderCache = () => {
  cacheHandle.instance?.close()
  fetcherCache.clear()
  cacheHandle.instance = null
}
