import { logWarning } from "@mux-magic/tools"

import type {
  ProviderCache,
  ProviderCacheRow,
} from "./providerCache.js"

// `cachedFetch` covers a provider read that is one HTTP request. Some
// provider reads are not: DVDCompare's extras list is a headless-Chromium
// session that loads a film page, ticks a release checkbox, submits a form
// and reads the result. The answer is still a provider response keyed by a
// URL, and it still belongs in `provider-cache.sqlite` under the same
// time-to-live — only the way it is obtained differs.
//
// The value is stored as JSON, so it must be JSON-serialisable.
export type CachedComputation = <Value>(props: {
  produceValue: () => Promise<Value>
  requestKey: string
}) => Promise<Value>

const parseCachedValue = <Value>(
  body: string,
): { value: Value } | null => {
  try {
    return { value: JSON.parse(body) as Value }
  } catch {
    return null
  }
}

const describeThrownError = (thrownError: unknown) =>
  thrownError instanceof Error
    ? thrownError.message
    : String(thrownError)

const describeStaleAge = (fetchedAt: number) =>
  `${Math.round((Date.now() - fetchedAt) / (60 * 60 * 1000))} hour(s) old`

// Same policy as `cachedFetch`'s stale-on-error: a stored value came from
// a successful read, so returning it beats failing the run outright. A
// failure is never stored.
const serveStaleValue = <Value>({
  provider,
  requestKey,
  staleRow,
  thrownError,
}: {
  provider: string
  requestKey: string
  staleRow: ProviderCacheRow | null
  thrownError: unknown
}): Promise<Value> =>
  ((parsed: { value: Value } | null) =>
    parsed === null || staleRow === null
      ? Promise.reject(thrownError)
      : (logWarning(
          "PROVIDER CACHE STALE",
          `${provider} could not be read for ${requestKey}; serving the cached copy (${describeStaleAge(staleRow.fetchedAt)}). Cause: ${describeThrownError(thrownError)}`,
        ) ?? Promise.resolve(parsed.value)))(
    staleRow === null
      ? null
      : parseCachedValue<Value>(staleRow.body),
  )

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
  ).then(() => value)

export const createCachedComputation =
  ({
    cache,
    provider,
  }: {
    cache: ProviderCache
    provider: string
  }): CachedComputation =>
  <Value>({
    produceValue,
    requestKey,
  }: {
    produceValue: () => Promise<Value>
    requestKey: string
  }) =>
    ((freshRow: ProviderCacheRow | null) =>
      ((parsedFreshValue: { value: Value } | null) =>
        parsedFreshValue === null
          ? produceValue()
              .then((value) =>
                storeValue({
                  cache,
                  provider,
                  requestKey,
                  value,
                }),
              )
              .catch((thrownError: unknown) =>
                serveStaleValue<Value>({
                  provider,
                  requestKey,
                  staleRow: cache.getStale({
                    provider,
                    requestKey,
                  }),
                  thrownError,
                }),
              )
          : Promise.resolve(parsedFreshValue.value))(
        freshRow === null
          ? null
          : parseCachedValue<Value>(freshRow.body),
      ))(cache.get({ provider, requestKey }))
