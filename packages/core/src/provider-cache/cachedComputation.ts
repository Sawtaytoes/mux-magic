import {
  type NetworkFirstOutcome,
  resolveNetworkFirst,
} from "./networkFirst.js"
import type {
  ProviderCache,
  ProviderCacheProvider,
  ProviderCacheRow,
} from "./providerCache.js"

// `cachedFetch` covers a provider read that is one HTTP request. Some
// provider reads are not: DVDCompare's extras list is a headless-Chromium
// session that loads a film page, ticks a release checkbox, submits a form
// and reads the result; MyAnimeList goes through `mal-scraper`, which makes
// its own requests. The answer is still a provider response for a key, and
// it is still read network-first with the same fallback — only the way it
// is obtained differs.
//
// The value is stored as JSON, so it must be JSON-serialisable.
export type CachedComputation = <Value>(props: {
  // Asked only when the live production failed AND nothing is stored. Its
  // answer is stored like a live one. DVDCompare's Wayback archive.
  produceLastResortValue?: (
    thrownError: unknown,
  ) => Promise<Value>
  produceValue: () => Promise<Value>
  requestKey: string
}) => Promise<Value>

// A scrape has no single request to put a timeout on, so the whole
// production is bounded instead. It cannot be cancelled from here — the
// browser's own `finally` still closes it — but the job stops waiting.
export const DEFAULT_COMPUTATION_TIMEOUT_MILLISECONDS = 120_000

type ParseOutcome<Value> = {
  value: Value | null
}

const captureParsedValue = <Value>({
  outcome,
  row,
}: {
  outcome: ParseOutcome<Value>
  row: ProviderCacheRow
}) => {
  try {
    outcome.value = JSON.parse(row.body) as Value
  } catch {
    outcome.value = null
  }
}

// A stored JSON `null` reads as "nothing usable", which is harmless:
// every producer here returns an object or an array.
const parseCachedValue = <Value>(row: ProviderCacheRow) =>
  ((outcome: ParseOutcome<Value>) =>
    captureParsedValue({ outcome, row }) ?? outcome.value)({
    value: null,
  })

const storeValue = <Value>({
  cache,
  provider,
  requestKey,
  value,
}: {
  cache: ProviderCache
  provider: string
  requestKey: string
  value: Value
}) =>
  Promise.resolve(
    cache.set({
      body: JSON.stringify(value),
      provider,
      requestKey,
    }),
  ).then(
    (): NetworkFirstOutcome<Value> => ({
      source: "network",
      value,
    }),
  )

export const withTimeout = <Value>({
  describeRequest,
  produceValue,
  timeoutMilliseconds,
}: {
  describeRequest: string
  produceValue: () => Promise<Value>
  timeoutMilliseconds: number
}) =>
  ((timerHolder: Map<"timer", NodeJS.Timeout>) =>
    Promise.race([
      produceValue(),
      new Promise<never>((_resolve, reject) => {
        timerHolder.set(
          "timer",
          setTimeout(() => {
            reject(
              Object.assign(
                new Error(
                  `${describeRequest} timed out after ${timeoutMilliseconds} ms`,
                ),
                { name: "TimeoutError" },
              ),
            )
          }, timeoutMilliseconds),
        )
      }),
    ]).finally(() => {
      clearTimeout(timerHolder.get("timer"))
    }))(new Map())

export const createCachedComputation =
  ({
    cache,
    isUnreachable,
    provider,
    timeoutMilliseconds = DEFAULT_COMPUTATION_TIMEOUT_MILLISECONDS,
  }: {
    cache: ProviderCache
    isUnreachable?: (thrownError: unknown) => boolean
    provider: ProviderCacheProvider
    timeoutMilliseconds?: number
  }): CachedComputation =>
  <Value>({
    produceLastResortValue,
    produceValue,
    requestKey,
  }: {
    produceLastResortValue?: (
      thrownError: unknown,
    ) => Promise<Value>
    produceValue: () => Promise<Value>
    requestKey: string
  }) =>
    resolveNetworkFirst<Value>({
      cache,
      isUnreachable,
      provider,
      readCachedValue: (row) =>
        parseCachedValue<Value>(row),
      request: requestKey,
      requestFromNetwork: () =>
        withTimeout({
          describeRequest: `${provider} ${requestKey}`,
          produceValue,
          timeoutMilliseconds,
        }).then((value) =>
          storeValue({
            cache,
            provider,
            requestKey,
            value,
          }),
        ),
      requestKey,
      requestLastResort:
        produceLastResortValue === undefined
          ? undefined
          : (thrownError) =>
              produceLastResortValue(thrownError).then(
                (value) =>
                  storeValue({
                    cache,
                    provider,
                    requestKey,
                    value,
                  }),
              ),
    }).then(({ value }) => value)
