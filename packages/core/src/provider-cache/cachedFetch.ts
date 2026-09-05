import { logWarning } from "@mux-magic/tools"

import type {
  ProviderCache,
  ProviderCacheRow,
} from "./providerCache.js"
import {
  createRateLimiter,
  delayForMilliseconds,
  type RateLimiter,
} from "./rateLimiter.js"

export type CachedFetchOutcome = {
  body: string
  isFromCache: boolean
  // True only on the stale-on-error path below: the entry is past its
  // time to live and the provider could not be reached to refresh it.
  // Optional so every existing stub that returns `{ body, isFromCache }`
  // still satisfies the type.
  isStale?: boolean
}

// How a provider's bytes become the string this module caches. The default
// is `Response.text()`, which decodes strictly by the Content-Type charset
// — right for the JSON APIs, wrong for DVDCompare, whose legacy pages are
// Windows-1252 bytes mislabelled as UTF-8. A provider that needs its own
// decoder (or that has to carry response metadata such as the post-redirect
// URL alongside the body) injects one here rather than making this module
// import from `tools/`.
export type DecodeResponseBody = (
  response: Response,
) => Promise<string>

const decodeResponseTextByDefault: DecodeResponseBody = (
  response,
) => response.text()

// `fetch` ignores properties it does not know, so carrying the cache key
// on the init object costs nothing at the network layer and keeps the
// two-argument `CachedFetch` shape every call site already uses.
//
// ⚠️ Needed because the cache is keyed on the URL alone. That is correct
// for a GET provider, where the URL IS the request. It is wrong for a
// POST provider: AcoustID takes an 8 KB fingerprint in the body and every
// lookup posts to the same `/v2/lookup` URL, so without this every track
// after the first would read the first track's cached answer.
export type CachedFetchInit = RequestInit & {
  cacheKey?: string
}

// 429 and 503 are the two statuses every provider here uses to say
// "later, not never". Everything else non-2xx is a real failure.
const RETRYABLE_STATUS_CODES = new Set([429, 503])
const NOT_MODIFIED_STATUS_CODE = 304
const DEFAULT_MAXIMUM_ATTEMPTS = 3
const DEFAULT_RETRY_BACKOFF_MILLISECONDS = 1000
const DEFAULT_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 1000

type RequestContext = {
  cache: ProviderCache
  decodeResponseBody: DecodeResponseBody
  initialization: CachedFetchInit | undefined
  maximumAttempts: number
  provider: string
  rateLimiter: RateLimiter
  requestKey: string
  retryBackoffMilliseconds: number
  staleRow: ProviderCacheRow | null
  url: string
  userAgent: string
}

const buildHeaders = ({
  initialization,
  staleRow,
  userAgent,
}: {
  initialization: CachedFetchInit | undefined
  staleRow: ProviderCacheRow | null
  userAgent: string
}) => ({
  ...(initialization?.headers as
    | Record<string, string>
    | undefined),
  ...(staleRow?.etag
    ? { "If-None-Match": staleRow.etag }
    : {}),
  // Last, so a caller can never drop the descriptive agent MusicBrainz
  // demands. It blocks the IP address, and that address is the house.
  "User-Agent": userAgent,
})

// `cacheKey` is ours, not the platform's. Dropping it keeps `fetch` from
// ever seeing a property it does not define.
const toRequestInit = (
  initialization: CachedFetchInit | undefined,
): RequestInit | undefined =>
  initialization === undefined
    ? undefined
    : (({
        cacheKey: _ignoredCacheKey,
        ...requestInit
      }: CachedFetchInit) => requestInit)(initialization)

const requestOnce = ({
  attemptNumber,
  requestContext,
}: {
  attemptNumber: number
  requestContext: RequestContext
}): Promise<Response> =>
  requestContext.rateLimiter
    .schedule(() =>
      fetch(requestContext.url, {
        ...toRequestInit(requestContext.initialization),
        headers: buildHeaders({
          initialization: requestContext.initialization,
          staleRow: requestContext.staleRow,
          userAgent: requestContext.userAgent,
        }),
      }),
    )
    .then((response) =>
      RETRYABLE_STATUS_CODES.has(response.status) &&
      attemptNumber < requestContext.maximumAttempts
        ? delayForMilliseconds(
            requestContext.retryBackoffMilliseconds *
              2 ** (attemptNumber - 1),
          ).then(() =>
            requestOnce({
              attemptNumber: attemptNumber + 1,
              requestContext,
            }),
          )
        : response,
    )

const resolveNotModified = ({
  cache,
  provider,
  requestKey,
  staleRow,
  url,
}: {
  cache: ProviderCache
  provider: string
  requestKey: string
  staleRow: ProviderCacheRow | null
  url: string
}) =>
  staleRow === null
    ? Promise.reject(
        new Error(
          `${provider} answered 304 for ${url} but nothing was cached for it.`,
        ),
      )
    : Promise.resolve(
        cache.set({
          body: staleRow.body,
          etag: staleRow.etag,
          provider,
          requestKey,
        }),
      ).then(() => ({
        body: staleRow.body,
        isFromCache: true,
      }))

const resolveFreshResponse = ({
  cache,
  decodeResponseBody,
  provider,
  requestKey,
  response,
  url,
}: {
  cache: ProviderCache
  decodeResponseBody: DecodeResponseBody
  provider: string
  requestKey: string
  response: Response
  url: string
}) =>
  response.ok
    ? decodeResponseBody(response).then((body) =>
        Promise.resolve(
          cache.set({
            body,
            etag: response.headers.get("etag"),
            provider,
            requestKey,
          }),
        ).then(() => ({ body, isFromCache: false })),
      )
    : Promise.reject(
        new Error(
          `${provider} request failed with status ${response.status} for ${url}`,
        ),
      )

const fetchAndStore = (requestContext: RequestContext) =>
  requestOnce({ attemptNumber: 1, requestContext }).then(
    (response) =>
      response.status === NOT_MODIFIED_STATUS_CODE
        ? resolveNotModified({
            cache: requestContext.cache,
            provider: requestContext.provider,
            requestKey: requestContext.requestKey,
            staleRow: requestContext.staleRow,
            url: requestContext.url,
          })
        : resolveFreshResponse({
            cache: requestContext.cache,
            decodeResponseBody:
              requestContext.decodeResponseBody,
            provider: requestContext.provider,
            requestKey: requestContext.requestKey,
            response,
            url: requestContext.url,
          }),
  )

const describeThrownError = (thrownError: unknown) =>
  thrownError instanceof Error
    ? thrownError.message
    : String(thrownError)

const describeStaleAge = (fetchedAt: number) =>
  `${Math.round((Date.now() - fetchedAt) / (60 * 60 * 1000))} hour(s) old`

// Stale-on-error. A plain time-to-live cache still fails hard when the
// entry has expired AND the provider is unreachable — which is the exact
// shape of a DVDCompare outage: the answer is on disk, one day past its
// week, and the run dies with `TypeError: fetch failed`.
//
// A row only exists because the provider itself once returned it with a
// 200, so serving it is never an invention. It is not "caching a
// failure" either: nothing new is written, and the next successful fetch
// replaces the row as usual. The outcome carries `isStale: true` so a
// caller that cares can say so.
//
// The staleness is deliberately uncapped. An age limit would restore the
// hard failure this removes, and the cache is disposable — deleting
// `provider-cache.sqlite` is the escape hatch when an entry is wrong.
const serveStaleOnError = ({
  provider,
  staleRow,
  thrownError,
  url,
}: {
  provider: string
  staleRow: ProviderCacheRow | null
  thrownError: unknown
  url: string
}): Promise<CachedFetchOutcome> =>
  staleRow === null
    ? Promise.reject(thrownError)
    : (logWarning(
        "PROVIDER CACHE STALE",
        `${provider} could not be reached for ${url}; serving the cached copy (${describeStaleAge(staleRow.fetchedAt)}). Cause: ${describeThrownError(thrownError)}`,
      ) ??
      Promise.resolve({
        body: staleRow.body,
        isFromCache: true,
        isStale: true,
      }))

const fetchAndStoreOrServeStale = (
  requestContext: RequestContext,
) =>
  fetchAndStore(requestContext).catch(
    (thrownError: unknown) =>
      serveStaleOnError({
        provider: requestContext.provider,
        staleRow: requestContext.staleRow,
        thrownError,
        url: requestContext.url,
      }),
  )

export const createCachedFetch = ({
  cache,
  decodeResponseBody = decodeResponseTextByDefault,
  maximumAttempts = DEFAULT_MAXIMUM_ATTEMPTS,
  minimumRequestIntervalMilliseconds = DEFAULT_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider,
  retryBackoffMilliseconds = DEFAULT_RETRY_BACKOFF_MILLISECONDS,
  userAgent,
}: {
  cache: ProviderCache
  decodeResponseBody?: DecodeResponseBody
  maximumAttempts?: number
  minimumRequestIntervalMilliseconds?: number
  provider: string
  retryBackoffMilliseconds?: number
  userAgent: string
}) =>
  (
    (rateLimiter: RateLimiter) =>
    (
      url: string,
      initialization?: CachedFetchInit,
    ): Promise<CachedFetchOutcome> =>
      ((requestKey: string) =>
        ((freshRow: ProviderCacheRow | null) =>
          freshRow === null
            ? fetchAndStoreOrServeStale({
                cache,
                decodeResponseBody,
                initialization,
                maximumAttempts,
                provider,
                rateLimiter,
                requestKey,
                retryBackoffMilliseconds,
                staleRow: cache.getStale({
                  provider,
                  requestKey,
                }),
                url,
                userAgent,
              })
            : Promise.resolve({
                body: freshRow.body,
                isFromCache: true,
              }))(cache.get({ provider, requestKey })))(
        initialization?.cacheKey ?? url,
      )
  )(
    createRateLimiter({
      minimumIntervalMilliseconds:
        minimumRequestIntervalMilliseconds,
    }),
  )
