import type {
  ProviderCache,
  ProviderCacheRow,
} from "./providerCache.js"
import {
  buildProviderCacheFallback,
  describeThrownError,
  reportProviderCacheFallback,
} from "./providerCacheFallbacks.js"
import {
  closeProviderCircuit,
  getOpenProviderCircuit,
  openProviderCircuit,
  ProviderSkippedError,
} from "./providerCircuitBreaker.js"

// Where an answer came from. `fallback-cache` is the one the owner is told
// about: the provider was asked (or had already failed in this job) and
// the stored copy stood in for it.
export type NetworkFirstSource =
  | "fallback-cache"
  | "fresh-cache"
  | "network"

export type NetworkFirstOutcome<Value> = {
  source: NetworkFirstSource
  value: Value
}

// The failures that say "this provider cannot be reached", as opposed to
// "this provider answered, and the answer is no". Only these open the
// circuit: a 404 for one release says nothing about the next request.
const UNREACHABLE_MESSAGE_PATTERN =
  /(?:ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|fetch failed|net::ERR_|timed out|TimeoutError|Timeout \d+ms exceeded|socket hang up)/i

export const isProviderUnreachableError = (
  thrownError: unknown,
) =>
  thrownError instanceof TypeError ||
  (thrownError instanceof Error &&
    (thrownError.name === "TimeoutError" ||
      thrownError.name === "AbortError" ||
      (thrownError as { isProviderUnreachable?: boolean })
        .isProviderUnreachable === true)) ||
  UNREACHABLE_MESSAGE_PATTERN.test(
    describeThrownError(thrownError),
  )

// Marks an error as "the provider is unreachable" when its message alone
// would not say so — a 5xx, a spent retry budget on 429, an AniDB ban.
export const markProviderUnreachable = (error: Error) =>
  Object.assign(error, { isProviderUnreachable: true })

type ParsedRow<Value> = {
  row: ProviderCacheRow
  value: Value
}

const parseRow = <Value>({
  readCachedValue,
  row,
}: {
  readCachedValue: (row: ProviderCacheRow) => Value | null
  row: ProviderCacheRow | null
}) =>
  row === null
    ? null
    : ((value: Value | null) =>
        value === null ? null : { row, value })(
        readCachedValue(row),
      )

const serveFallback = <Value>({
  cause,
  cachedEntry,
  isProviderSkipped,
  provider,
  request,
}: {
  cause: string
  cachedEntry: ParsedRow<Value>
  isProviderSkipped: boolean
  provider: string
  request: string
}): NetworkFirstOutcome<Value> =>
  reportProviderCacheFallback(
    buildProviderCacheFallback({
      cause,
      fetchedAt: cachedEntry.row.fetchedAt,
      isProviderSkipped,
      provider,
      request,
    }),
  ) ?? {
    source: "fallback-cache",
    value: cachedEntry.value,
  }

const recordFailure = ({
  isUnreachable,
  provider,
  thrownError,
}: {
  isUnreachable: (thrownError: unknown) => boolean
  provider: string
  thrownError: unknown
}) => {
  if (isUnreachable(thrownError)) {
    openProviderCircuit({
      cause: describeThrownError(thrownError),
      provider,
    })
  }
}

type RequestLastResort<Value> = (
  thrownError: unknown,
) => Promise<NetworkFirstOutcome<Value>>

const rejectOrRequestLastResort = <Value>({
  requestLastResort,
  thrownError,
}: {
  requestLastResort: RequestLastResort<Value> | undefined
  thrownError: unknown
}) =>
  requestLastResort === undefined
    ? Promise.reject(thrownError)
    : requestLastResort(thrownError)

const requestWithFallback = <Value>({
  cachedEntry,
  cachedRow,
  isUnreachable,
  provider,
  request,
  requestFromNetwork,
  requestLastResort,
}: {
  cachedEntry: ParsedRow<Value> | null
  cachedRow: ProviderCacheRow | null
  isUnreachable: (thrownError: unknown) => boolean
  provider: string
  request: string
  requestFromNetwork: (
    cachedRow: ProviderCacheRow | null,
  ) => Promise<NetworkFirstOutcome<Value>>
  requestLastResort: RequestLastResort<Value> | undefined
}) =>
  requestFromNetwork(cachedRow).then(
    (outcome) => closeProviderCircuit(provider) ?? outcome,
    (thrownError: unknown) =>
      recordFailure({
        isUnreachable,
        provider,
        thrownError,
      }) ??
      (cachedEntry === null
        ? rejectOrRequestLastResort({
            requestLastResort,
            thrownError,
          })
        : serveFallback({
            cachedEntry,
            cause: describeThrownError(thrownError),
            isProviderSkipped: false,
            provider,
            request,
          })),
  )

// The one policy, shared by `cachedFetch` (one HTTP request) and
// `cachedComputation` (a scrape, or any other read that is not one
// request):
//
//  1. Inside the provider's fresh window (AniDB only) → the stored answer,
//     no request.
//  2. The provider already failed in this job → the stored answer, no
//     request; with nothing stored, fail at once rather than wait out
//     another timeout.
//  3. Otherwise ask the provider. `requestFromNetwork` stores what it gets.
//  4. The request failed → the stored answer at ANY age, reported to the
//     owner. Nothing stored → `requestLastResort` when the caller has one
//     (DVDCompare's Wayback archive), otherwise the original failure.
//
// A failure is never written. The fallback only ever reads a row the
// provider itself returned with a 200 on an earlier run.
export const resolveNetworkFirst = <Value>({
  cache,
  isUnreachable = isProviderUnreachableError,
  provider,
  readCachedValue,
  request,
  requestFromNetwork,
  requestKey,
  requestLastResort,
}: {
  cache: ProviderCache
  isUnreachable?: (thrownError: unknown) => boolean
  provider: string
  readCachedValue: (row: ProviderCacheRow) => Value | null
  request: string
  requestFromNetwork: (
    cachedRow: ProviderCacheRow | null,
  ) => Promise<NetworkFirstOutcome<Value>>
  requestKey: string
  requestLastResort?: RequestLastResort<Value>
}) =>
  ((freshEntry: ParsedRow<Value> | null) =>
    freshEntry === null
      ? ((cachedRow: ProviderCacheRow | null) =>
          ((cachedEntry: ParsedRow<Value> | null) =>
            ((openCircuit) =>
              openCircuit === null
                ? requestWithFallback({
                    cachedEntry,
                    cachedRow,
                    isUnreachable,
                    provider,
                    request,
                    requestFromNetwork,
                    requestLastResort,
                  })
                : cachedEntry === null
                  ? rejectOrRequestLastResort({
                      requestLastResort,
                      thrownError: new ProviderSkippedError(
                        {
                          cause: openCircuit.cause,
                          provider,
                          request,
                        },
                      ),
                    })
                  : Promise.resolve(
                      serveFallback({
                        cachedEntry,
                        cause: openCircuit.cause,
                        isProviderSkipped: true,
                        provider,
                        request,
                      }),
                    ))(getOpenProviderCircuit(provider)))(
            parseRow({ readCachedValue, row: cachedRow }),
          ))(cache.getStale({ provider, requestKey }))
      : Promise.resolve<NetworkFirstOutcome<Value>>({
          source: "fresh-cache",
          value: freshEntry.value,
        }))(
    parseRow({
      readCachedValue,
      row: cache.get({ provider, requestKey }),
    }),
  )
