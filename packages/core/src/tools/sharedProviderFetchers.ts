import {
  type CachedComputation,
  createCachedComputation,
} from "../provider-cache/cachedComputation.js"
import {
  type CachedFetchInit,
  type CachedFetchOutcome,
  createCachedFetch,
  type DecodeResponseBody,
} from "../provider-cache/cachedFetch.js"
import type { ProviderCacheProvider } from "../provider-cache/providerCache.js"
import {
  getSharedProviderCache,
  registerProviderCacheResetHandler,
} from "./sharedProviderCache.js"

// The metadata providers that are not music providers — TMDB, TVDB, AniDB,
// Jikan, AnimeThemes, MyAnimeList, the Criterion forum. The music ones keep
// musicProviderFetchers.ts, which also carries MusicBrainz's User-Agent
// rule; none of these providers asks for a particular agent, so they share
// one that names the project.
export const MUX_MAGIC_USER_AGENT =
  "mux-magic/1.0 (+https://github.com/Sawtaytoes/mux-magic)"

export type SharedCachedFetch = (
  url: string,
  initialization?: CachedFetchInit,
) => Promise<CachedFetchOutcome>

type SharedCachedFetchOptions = {
  decodeResponseBody?: DecodeResponseBody
  minimumRequestIntervalMilliseconds: number
  provider: ProviderCacheProvider
  timeoutMilliseconds?: number
}

type SharedCachedComputationOptions = {
  provider: ProviderCacheProvider
  timeoutMilliseconds?: number
}

// Built once per provider and reused, for the same reason as the music
// fetchers: a per-request fetcher would build a new rate limiter each time
// and space nothing out.
const fetcherHolder = new Map<
  ProviderCacheProvider,
  SharedCachedFetch
>()

const computationHolder = new Map<
  ProviderCacheProvider,
  CachedComputation
>()

registerProviderCacheResetHandler(() => {
  fetcherHolder.clear()
  computationHolder.clear()
})

const getFetcher = ({
  decodeResponseBody,
  minimumRequestIntervalMilliseconds,
  provider,
  timeoutMilliseconds,
}: SharedCachedFetchOptions) =>
  fetcherHolder.get(provider) ??
  (fetcherHolder
    .set(
      provider,
      createCachedFetch({
        cache: getSharedProviderCache(),
        decodeResponseBody,
        minimumRequestIntervalMilliseconds,
        provider,
        timeoutMilliseconds,
        userAgent: MUX_MAGIC_USER_AGENT,
      }),
    )
    .get(provider) as SharedCachedFetch)

const getComputation = ({
  provider,
  timeoutMilliseconds,
}: SharedCachedComputationOptions) =>
  computationHolder.get(provider) ??
  (computationHolder
    .set(
      provider,
      createCachedComputation({
        cache: getSharedProviderCache(),
        provider,
        timeoutMilliseconds,
      }),
    )
    .get(provider) as CachedComputation)

// Lazy, so importing a provider module opens no database; the first read
// does.
export const buildSharedCachedFetch =
  (options: SharedCachedFetchOptions): SharedCachedFetch =>
  (url, initialization) =>
    getFetcher(options)(url, initialization)

export const buildSharedCachedComputation =
  (
    options: SharedCachedComputationOptions,
  ): CachedComputation =>
  (props) =>
    getComputation(options)(props)
