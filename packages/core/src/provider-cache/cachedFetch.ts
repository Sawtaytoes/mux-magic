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
  initialization: RequestInit | undefined
  maximumAttempts: number
  provider: string
  rateLimiter: RateLimiter
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
  initialization: RequestInit | undefined
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
        ...requestContext.initialization,
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
  staleRow,
  url,
}: {
  cache: ProviderCache
  provider: string
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
          requestKey: url,
        }),
      ).then(() => ({
        body: staleRow.body,
        isFromCache: true,
      }))

const resolveFreshResponse = ({
  cache,
  provider,
  response,
  url,
}: {
  cache: ProviderCache
  provider: string
  response: Response
  url: string
}) =>
  response.ok
    ? response.text().then((body) =>
        Promise.resolve(
          cache.set({
            body,
            etag: response.headers.get("etag"),
            provider,
            requestKey: url,
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
            staleRow: requestContext.staleRow,
            url: requestContext.url,
          })
        : resolveFreshResponse({
            cache: requestContext.cache,
            provider: requestContext.provider,
            response,
            url: requestContext.url,
          }),
  )

export const createCachedFetch = ({
  cache,
  maximumAttempts = DEFAULT_MAXIMUM_ATTEMPTS,
  minimumRequestIntervalMilliseconds = DEFAULT_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider,
  retryBackoffMilliseconds = DEFAULT_RETRY_BACKOFF_MILLISECONDS,
  userAgent,
}: {
  cache: ProviderCache
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
      initialization?: RequestInit,
    ): Promise<CachedFetchOutcome> =>
      ((freshRow: ProviderCacheRow | null) =>
        freshRow === null
          ? fetchAndStore({
              cache,
              initialization,
              maximumAttempts,
              provider,
              rateLimiter,
              retryBackoffMilliseconds,
              staleRow: cache.getStale({
                provider,
                requestKey: url,
              }),
              url,
              userAgent,
            })
          : Promise.resolve({
              body: freshRow.body,
              isFromCache: true,
            }))(cache.get({ provider, requestKey: url }))
  )(
    createRateLimiter({
      minimumIntervalMilliseconds:
        minimumRequestIntervalMilliseconds,
    }),
  )
