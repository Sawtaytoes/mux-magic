import { createCachedFetch } from "../provider-cache/cachedFetch.js"
import {
  openProviderCache,
  providerCacheDatabasePath,
} from "../provider-cache/providerCache.js"
import { ACOUSTID_MINIMUM_REQUEST_INTERVAL_MILLISECONDS } from "./acoustIdApi.js"
import {
  type CachedFetch,
  MUSICBRAINZ_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  requireMusicBrainzUserAgent,
} from "./musicBrainzApi.js"

// The Cover Art Archive is a redirector in front of the Internet Archive and
// asks for no particular rate. MusicBrainz allows one request per second and
// enforces it by blocking the address, so it keeps its own interval.
const COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 200

// A Map rather than a mutable field, so the lazy open stays an expression.
const sharedCache = new Map<
  "instance",
  ReturnType<typeof openProviderCache>
>()

const fetcherCache = new Map<string, CachedFetch>()

const getSharedProviderCache = () =>
  sharedCache.get("instance") ??
  (sharedCache
    .set(
      "instance",
      openProviderCache({
        databasePath: providerCacheDatabasePath,
      }),
    )
    .get("instance") as ReturnType<
    typeof openProviderCache
  >)

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

export const coverArtCachedFetch = buildFetcher({
  minimumRequestIntervalMilliseconds:
    COVER_ART_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "coverArtArchive",
})

export const closeSharedProviderCache = () => {
  sharedCache.get("instance")?.close()
  sharedCache.clear()
  fetcherCache.clear()
}
