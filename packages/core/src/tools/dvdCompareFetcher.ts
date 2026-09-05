import {
  type CachedComputation,
  createCachedComputation,
} from "../provider-cache/cachedComputation.js"
import {
  type CachedFetchInit,
  createCachedFetch,
} from "../provider-cache/cachedFetch.js"
import type { ProviderCache } from "../provider-cache/providerCache.js"
import { decodeResponseText } from "./decodeBufferWithEncodingFallback.js"
import { BROWSER_USER_AGENT } from "./launchBrowser.js"
import {
  getSharedProviderCache,
  registerProviderCacheResetHandler,
} from "./sharedProviderCache.js"

// The provider key in `provider-cache.sqlite`. It already has a seven-day
// time to live in PROVIDER_CACHE_TIME_TO_LIVE — that entry was written when
// the cache was designed, but nothing ever fetched through it, so the table
// held rows for the four music providers and none for DVDCompare.
export const DVDCOMPARE_PROVIDER = "dvdCompare"

// DVDCompare publishes no rate limit. This is a politeness number in line
// with the VGMdb and freedb scrapers, not a documented one. It also spaces
// out the two-request JS-redirect path so a search never reads as a burst.
export const DVDCOMPARE_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 500

// DVDCompare bot-blocks requests by User-Agent: a missing UA header or a
// `curl/*` UA both return HTTP 403. Single-sourced from launchBrowser's
// BROWSER_USER_AGENT so the fetch and headless-Chromium paths never drift.
export const DVDCOMPARE_USER_AGENT = BROWSER_USER_AGENT

// What the DVDCompare scrapers need out of a request. `html` is decoded
// through the byte-first charset fallback rather than `Response.text()`,
// `url` is the POST-redirect landing URL that tells a search apart from a
// direct film hit, and `status` feeds the releases-page debug payload.
export type DvdComparePage = {
  html: string
  status: number
  url: string
}

export type DvdComparePageFetcher = (
  url: string,
  initialization?: RequestInit,
) => Promise<DvdComparePage>

// The cache stores one string per entry, so the three fields ride together
// as JSON. Storing only the HTML would silently drop the redirect URL, and
// `isDirectListing` would then be wrong for every cached search.
const encodeDvdComparePage = async (
  response: Response,
): Promise<string> =>
  JSON.stringify({
    html: await decodeResponseText(response),
    status: response.status,
    url: response.url,
  } satisfies DvdComparePage)

const isDvdComparePage = (
  value: unknown,
): value is DvdComparePage =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as DvdComparePage).html === "string"

// A row written before this envelope existed, or a truncated one, decodes
// as plain HTML rather than throwing. The cache is disposable and must
// never be the thing that fails a run.
const decodeDvdComparePage = ({
  body,
  requestedUrl,
}: {
  body: string
  requestedUrl: string
}): DvdComparePage =>
  ((parsed: unknown) =>
    isDvdComparePage(parsed)
      ? parsed
      : { html: body, status: 200, url: requestedUrl })(
    ((): unknown => {
      try {
        return JSON.parse(body)
      } catch {
        return null
      }
    })(),
  )

// The search endpoint is a POST to one fixed URL, so the URL alone is not
// the request. Without this every search after the first would read the
// first search term's answer back out of the cache.
const buildCacheKey = ({
  initialization,
  url,
}: {
  initialization: RequestInit | undefined
  url: string
}) =>
  initialization?.body === undefined
    ? url
    : `${url}|${String(initialization.body)}`

export const createDvdComparePageFetcher = ({
  cache,
  minimumRequestIntervalMilliseconds = DVDCOMPARE_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
}: {
  cache: ProviderCache
  minimumRequestIntervalMilliseconds?: number
}): DvdComparePageFetcher =>
  (
    (
      cachedFetch: (
        url: string,
        initialization?: CachedFetchInit,
      ) => Promise<{ body: string }>,
    ) =>
    (url, initialization) =>
      cachedFetch(url, {
        ...initialization,
        cacheKey: buildCacheKey({ initialization, url }),
      }).then(({ body }) =>
        decodeDvdComparePage({ body, requestedUrl: url }),
      )
  )(
    createCachedFetch({
      cache,
      decodeResponseBody: encodeDvdComparePage,
      minimumRequestIntervalMilliseconds,
      provider: DVDCOMPARE_PROVIDER,
      userAgent: DVDCOMPARE_USER_AGENT,
    }),
  )

// Built once, like every fetcher in musicProviderFetchers — a per-request
// factory would create a new rate limiter each time and defeat the
// interval entirely.
const fetcherHolder = new Map<
  "instance",
  DvdComparePageFetcher
>()

registerProviderCacheResetHandler(() => {
  fetcherHolder.clear()
})

const getDvdComparePageFetcher = () =>
  fetcherHolder.get("instance") ??
  (fetcherHolder
    .set(
      "instance",
      createDvdComparePageFetcher({
        cache: getSharedProviderCache(),
      }),
    )
    .get("instance") as DvdComparePageFetcher)

export const fetchDvdComparePage: DvdComparePageFetcher = (
  url,
  initialization,
) => getDvdComparePageFetcher()(url, initialization)

// The extras scrape is a headless-Chromium session, not a fetch, so it
// needs the computation form of the cache rather than `cachedFetch`. It
// lands in the same table under the same `dvdCompare` provider and the
// same seven-day time to live.
export const createDvdCompareScrapeCache = ({
  cache,
}: {
  cache: ProviderCache
}) =>
  createCachedComputation({
    cache,
    provider: DVDCOMPARE_PROVIDER,
  })

const scrapeCacheHolder = new Map<
  "instance",
  CachedComputation
>()

registerProviderCacheResetHandler(() => {
  scrapeCacheHolder.clear()
})

export const cacheDvdCompareScrape: CachedComputation = (
  props,
) =>
  (
    scrapeCacheHolder.get("instance") ??
    (scrapeCacheHolder
      .set(
        "instance",
        createDvdCompareScrapeCache({
          cache: getSharedProviderCache(),
        }),
      )
      .get("instance") as CachedComputation)
  )(props)
