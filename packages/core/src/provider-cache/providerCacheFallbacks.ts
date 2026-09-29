import { logWarning } from "@mux-magic/tools"

// One answer that came out of the cache because the live request failed.
// This is what the owner is told about: the job log gets a warning line,
// and the job record gets this object so the Builder can show a notice.
export type ProviderCacheFallback = {
  // How old the served answer was when it was served.
  ageMilliseconds: number
  // ISO time the provider originally returned the served answer.
  cachedAt: string
  // Why the live answer was not used: the request's own error, or — when
  // `isProviderSkipped` — the error that stopped the provider earlier.
  cause: string
  // True when no request was made at all, because this provider had
  // already failed earlier in the same job. See providerCircuitBreaker.
  isProviderSkipped: boolean
  provider: string
  // What was asked for: the URL for an HTTP read, the request key for a
  // scrape. Never carries a credential — every provider here sends its key
  // in a header or a POST body.
  request: string
}

type ProviderCacheFallbackListener = (
  fallback: ProviderCacheFallback,
) => void

const listeners = new Set<ProviderCacheFallbackListener>()

// The job store registers here (see api/providerCacheFallbackBridge.ts),
// so this module never imports the job layer. Returns the unregister.
export const registerProviderCacheFallbackListener = (
  listener: ProviderCacheFallbackListener,
) =>
  listeners.add(listener) &&
  (() => {
    listeners.delete(listener)
  })

const millisecondsPerMinute = 60 * 1000
const millisecondsPerHour = 60 * millisecondsPerMinute
const millisecondsPerDay = 24 * millisecondsPerHour

const pluralize = ({
  count,
  unit,
}: {
  count: number
  unit: string
}) => `${count} ${unit}${count === 1 ? "" : "s"}`

// "3 days", "5 hours", "12 minutes" — the one unit a person reads first.
export const describeCacheAge = (
  ageMilliseconds: number,
) =>
  ageMilliseconds >= millisecondsPerDay
    ? pluralize({
        count: Math.floor(
          ageMilliseconds / millisecondsPerDay,
        ),
        unit: "day",
      })
    : ageMilliseconds >= millisecondsPerHour
      ? pluralize({
          count: Math.floor(
            ageMilliseconds / millisecondsPerHour,
          ),
          unit: "hour",
        })
      : pluralize({
          count: Math.max(
            0,
            Math.floor(
              ageMilliseconds / millisecondsPerMinute,
            ),
          ),
          unit: "minute",
        })

export const describeThrownError = (
  thrownError: unknown,
) =>
  thrownError instanceof Error
    ? thrownError.message
    : String(thrownError)

export const buildProviderCacheFallback = ({
  cause,
  fetchedAt,
  isProviderSkipped,
  provider,
  request,
}: {
  cause: string
  fetchedAt: number
  isProviderSkipped: boolean
  provider: string
  request: string
}) => ({
  ageMilliseconds: Math.max(0, Date.now() - fetchedAt),
  cachedAt: new Date(fetchedAt).toISOString(),
  cause,
  isProviderSkipped,
  provider,
  request,
})

export const PROVIDER_CACHE_FALLBACK_LOG_TITLE =
  "PROVIDER CACHE FALLBACK"

export const formatProviderCacheFallback = (
  fallback: ProviderCacheFallback,
) =>
  fallback.isProviderSkipped
    ? `${fallback.provider} already failed earlier in this run, so ${fallback.request} was not requested. Using the cached copy from ${describeCacheAge(fallback.ageMilliseconds)} ago (${fallback.cachedAt}). Earlier failure: ${fallback.cause}`
    : `${fallback.provider} could not answer ${fallback.request}. Using the cached copy from ${describeCacheAge(fallback.ageMilliseconds)} ago (${fallback.cachedAt}). Cause: ${fallback.cause}`

// The warning goes through `logWarning`, which the job log capture routes
// into the running job's log. The listeners put the same fact on the job
// record for the UI.
export const reportProviderCacheFallback = (
  fallback: ProviderCacheFallback,
) => {
  logWarning(
    PROVIDER_CACHE_FALLBACK_LOG_TITLE,
    formatProviderCacheFallback(fallback),
  )
  listeners.forEach((listener) => {
    listener(fallback)
  })
}
