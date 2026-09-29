import {
  markProviderUnreachable,
  type NetworkFirstOutcome,
  resolveNetworkFirst,
} from "./networkFirst.js"
import type {
  ProviderCache,
  ProviderCacheProvider,
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
  // True only when the live request FAILED and the stored copy stood in
  // for it — the case the owner is told about. A 304, or an AniDB entry
  // inside its one-day window, is `isFromCache` without this.
  // Optional so every existing stub that returns `{ body, isFromCache }`
  // still satisfies the type.
  isCacheFallback?: boolean
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

// Every request is bounded. Network-first asks the provider on every
// read, so a provider that accepts the connection and then says nothing
// would otherwise hold the whole job — and the cached fallback — hostage.
// One attempt, not the whole retry sequence: a 429 retry gets its own.
export const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 20_000

// The transport. `globalThis.fetch` by default; DVDCompare injects one that
// tries the plain-http twin when TLS fails, so that retry counts as the
// live request rather than as a fallback.
export type FetchImplementation = (
  url: string,
  initialization: RequestInit,
) => Promise<Response>

const fetchWithGlobalFetch: FetchImplementation = (
  url,
  initialization,
) => fetch(url, initialization)

type RequestContext = {
  cache: ProviderCache
  cachedRow: ProviderCacheRow | null
  decodeResponseBody: DecodeResponseBody
  fetchImplementation: FetchImplementation
  initialization: CachedFetchInit | undefined
  maximumAttempts: number
  provider: string
  rateLimiter: RateLimiter
  requestKey: string
  retryBackoffMilliseconds: number
  timeoutMilliseconds: number
  url: string
  userAgent: string
}

const buildHeaders = ({
  cachedRow,
  initialization,
  userAgent,
}: {
  cachedRow: ProviderCacheRow | null
  initialization: CachedFetchInit | undefined
  userAgent: string
}) => ({
  ...(initialization?.headers as
    | Record<string, string>
    | undefined),
  // Revalidation is still "grabbing the latest": the provider decides
  // whether the stored copy is current, and a 304 refreshes the row.
  ...(cachedRow?.etag
    ? { "If-None-Match": cachedRow.etag }
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

// A caller's own signal still cancels the request; the timeout is added
// beside it rather than replacing it.
const buildSignal = ({
  initialization,
  timeoutMilliseconds,
}: {
  initialization: CachedFetchInit | undefined
  timeoutMilliseconds: number
}) =>
  initialization?.signal
    ? AbortSignal.any([
        initialization.signal,
        AbortSignal.timeout(timeoutMilliseconds),
      ])
    : AbortSignal.timeout(timeoutMilliseconds)

const toTimeoutError = ({
  provider,
  thrownError,
  timeoutMilliseconds,
  url,
}: {
  provider: string
  thrownError: unknown
  timeoutMilliseconds: number
  url: string
}) =>
  thrownError instanceof Error &&
  thrownError.name === "TimeoutError"
    ? Object.assign(
        new Error(
          `${provider} request timed out after ${timeoutMilliseconds} ms for ${url}`,
        ),
        { name: "TimeoutError" },
      )
    : thrownError

const requestOnce = ({
  attemptNumber,
  requestContext,
}: {
  attemptNumber: number
  requestContext: RequestContext
}): Promise<Response> =>
  requestContext.rateLimiter
    .schedule(() =>
      requestContext.fetchImplementation(
        requestContext.url,
        {
          ...toRequestInit(requestContext.initialization),
          headers: buildHeaders({
            cachedRow: requestContext.cachedRow,
            initialization: requestContext.initialization,
            userAgent: requestContext.userAgent,
          }),
          signal: buildSignal({
            initialization: requestContext.initialization,
            timeoutMilliseconds:
              requestContext.timeoutMilliseconds,
          }),
        },
      ),
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
  cachedRow,
  provider,
  requestKey,
  url,
}: {
  cache: ProviderCache
  cachedRow: ProviderCacheRow | null
  provider: string
  requestKey: string
  url: string
}): Promise<NetworkFirstOutcome<CachedFetchOutcome>> =>
  cachedRow === null
    ? Promise.reject(
        new Error(
          `${provider} answered 304 for ${url} but nothing was cached for it.`,
        ),
      )
    : Promise.resolve(
        cache.set({
          body: cachedRow.body,
          etag: cachedRow.etag,
          provider,
          requestKey,
        }),
      ).then(() => ({
        source: "network",
        value: { body: cachedRow.body, isFromCache: true },
      }))

// A 5xx, or a 429/503 that outlasted every retry, is the provider saying it
// cannot serve anyone right now — that opens the circuit. A 404 is an
// answer about one resource and does not.
const buildStatusError = ({
  provider,
  status,
  url,
}: {
  provider: string
  status: number
  url: string
}) =>
  ((statusError: Error) =>
    status >= 500 || RETRYABLE_STATUS_CODES.has(status)
      ? markProviderUnreachable(statusError)
      : statusError)(
    // `status` rides along so an adapter that must hand a Response back
    // (the TVDB client) can rebuild the provider's own answer.
    Object.assign(
      new Error(
        `${provider} request failed with status ${status} for ${url}`,
      ),
      { status },
    ),
  )

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
}): Promise<NetworkFirstOutcome<CachedFetchOutcome>> =>
  response.ok
    ? decodeResponseBody(response).then((body) =>
        Promise.resolve(
          cache.set({
            body,
            etag: response.headers.get("etag"),
            provider,
            requestKey,
          }),
        ).then(() => ({
          source: "network",
          value: { body, isFromCache: false },
        })),
      )
    : Promise.reject(
        buildStatusError({
          provider,
          status: response.status,
          url,
        }),
      )

const fetchAndStore = (
  requestContext: RequestContext,
): Promise<NetworkFirstOutcome<CachedFetchOutcome>> =>
  requestOnce({ attemptNumber: 1, requestContext })
    .then((response) =>
      response.status === NOT_MODIFIED_STATUS_CODE
        ? resolveNotModified({
            cache: requestContext.cache,
            cachedRow: requestContext.cachedRow,
            provider: requestContext.provider,
            requestKey: requestContext.requestKey,
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
    .catch((thrownError: unknown) =>
      Promise.reject(
        toTimeoutError({
          provider: requestContext.provider,
          thrownError,
          timeoutMilliseconds:
            requestContext.timeoutMilliseconds,
          url: requestContext.url,
        }),
      ),
    )

const toCachedFetchOutcome = ({
  source,
  value,
}: NetworkFirstOutcome<CachedFetchOutcome>) =>
  source === "network"
    ? value
    : {
        body: value.body,
        isCacheFallback: source === "fallback-cache",
        isFromCache: true,
      }

// Network-first (see networkFirst.ts): every read asks the provider, and
// the stored row answers only when that request fails — at any age, and
// reported to the owner. AniDB alone serves a row inside its one-day
// window without asking.
export const createCachedFetch = ({
  cache,
  decodeResponseBody = decodeResponseTextByDefault,
  fetchImplementation = fetchWithGlobalFetch,
  maximumAttempts = DEFAULT_MAXIMUM_ATTEMPTS,
  minimumRequestIntervalMilliseconds = DEFAULT_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider,
  retryBackoffMilliseconds = DEFAULT_RETRY_BACKOFF_MILLISECONDS,
  timeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  userAgent,
}: {
  cache: ProviderCache
  decodeResponseBody?: DecodeResponseBody
  fetchImplementation?: FetchImplementation
  maximumAttempts?: number
  minimumRequestIntervalMilliseconds?: number
  provider: ProviderCacheProvider
  retryBackoffMilliseconds?: number
  timeoutMilliseconds?: number
  userAgent: string
}) =>
  (
    (rateLimiter: RateLimiter) =>
    (
      url: string,
      initialization?: CachedFetchInit,
    ): Promise<CachedFetchOutcome> =>
      ((requestKey: string) =>
        resolveNetworkFirst<CachedFetchOutcome>({
          cache,
          provider,
          readCachedValue: (row) => ({
            body: row.body,
            isFromCache: true,
          }),
          request: url,
          requestFromNetwork: (cachedRow) =>
            fetchAndStore({
              cache,
              cachedRow,
              decodeResponseBody,
              fetchImplementation,
              initialization,
              maximumAttempts,
              provider,
              rateLimiter,
              requestKey,
              retryBackoffMilliseconds,
              timeoutMilliseconds,
              url,
              userAgent,
            }),
          requestKey,
        }).then(toCachedFetchOutcome))(
        initialization?.cacheKey ?? url,
      )
  )(
    createRateLimiter({
      minimumIntervalMilliseconds:
        minimumRequestIntervalMilliseconds,
    }),
  )
