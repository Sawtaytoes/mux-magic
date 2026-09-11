import { logWarning } from "@mux-magic/tools"
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

const WAYBACK_AVAILABILITY_URL =
  "https://archive.org/wayback/available"
const WAYBACK_CDX_URL =
  "https://web.archive.org/cdx/search/cdx"
const WAYBACK_REPLAY_BASE_URL =
  "https://web.archive.org/web"
const WAYBACK_REQUEST_TIMEOUT_MILLISECONDS = 45_000

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

type WaybackCapture = {
  originalUrl: string
  timestamp: string
}

const getDvdCompareFilmId = (url: string) =>
  ((parsedUrl: URL) =>
    /^(?:www\.)?dvdcompare\.net$/i.test(
      parsedUrl.hostname,
    ) &&
    parsedUrl.pathname === "/comparisons/film.php" &&
    /^\d+$/.test(parsedUrl.searchParams.get("fid") ?? "")
      ? parsedUrl.searchParams.get("fid")
      : null)(new URL(url))

const parseLatestWaybackCapture = (
  body: string,
): WaybackCapture | null =>
  ((parsed: unknown) =>
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (
      parsed as {
        archived_snapshots?: {
          closest?: {
            timestamp?: unknown
            url?: unknown
          }
        }
      }
    ).archived_snapshots?.closest?.timestamp === "string" &&
    typeof (
      parsed as {
        archived_snapshots?: {
          closest?: { url?: unknown }
        }
      }
    ).archived_snapshots?.closest?.url === "string"
      ? {
          originalUrl: (
            parsed as {
              archived_snapshots: {
                closest: { url: string }
              }
            }
          ).archived_snapshots.closest.url.replace(
            /^https?:\/\/web\.archive\.org\/web\/\d+(?:[a-z_]+)?\//i,
            "",
          ),
          timestamp: (
            parsed as {
              archived_snapshots: {
                closest: { timestamp: string }
              }
            }
          ).archived_snapshots.closest.timestamp,
        }
      : null)(
    (() => {
      try {
        return JSON.parse(body) as unknown
      } catch {
        return null
      }
    })(),
  )

const fetchWaybackResponse = (url: string) =>
  fetch(url, {
    headers: { "User-Agent": DVDCOMPARE_USER_AGENT },
    signal: AbortSignal.timeout(
      WAYBACK_REQUEST_TIMEOUT_MILLISECONDS,
    ),
  }).then((response) =>
    response.ok
      ? response
      : Promise.reject(
          new Error(
            `Wayback Machine request failed with status ${response.status} for ${url}`,
          ),
        ),
  )

const getWaybackCandidateUrls = (filmId: string) => [
  `https://www.dvdcompare.net/comparisons/film.php?fid=${filmId}`,
  `https://dvdcompare.net/comparisons/film.php?fid=${filmId}`,
  `http://www.dvdcompare.net/comparisons/film.php?fid=${filmId}`,
  `http://dvdcompare.net/comparisons/film.php?fid=${filmId}`,
]

const findWaybackCapture = (filmId: string) =>
  getWaybackCandidateUrls(filmId).reduce<
    Promise<WaybackCapture | null>
  >(
    (capturePromise, candidateUrl) =>
      capturePromise.then((capture) =>
        capture === null
          ? fetchWaybackResponse(
              `${WAYBACK_AVAILABILITY_URL}?${new URLSearchParams(
                { url: candidateUrl },
              ).toString()}`,
            )
              .then((response) => response.text())
              .then(parseLatestWaybackCapture)
              // A failing Availability API is not an answer about whether a
              // capture exists. It rate-limits this household's egress with
              // HTTP 429, and a rejection here used to abort the whole
              // fallback before the CDX index was ever asked — even though
              // CDX answers the same question and was not rate-limited.
              .catch(() => null)
          : capture,
      ),
    Promise.resolve(null),
  )

const parseNewestCdxCapture = (
  body: string,
): WaybackCapture | null =>
  ((parsed: unknown) =>
    Array.isArray(parsed)
      ? (parsed
          .slice(1)
          .toReversed()
          .map((row) =>
            Array.isArray(row) &&
            typeof row[0] === "string" &&
            typeof row[1] === "string"
              ? { timestamp: row[0], originalUrl: row[1] }
              : null,
          )
          .find((capture) => capture !== null) ?? null)
      : null)(
    (() => {
      try {
        return JSON.parse(body) as unknown
      } catch {
        return null
      }
    })(),
  )

const findWaybackCdxCapture = (filmId: string) =>
  fetchWaybackResponse(
    `${WAYBACK_CDX_URL}?${new URLSearchParams({
      url: `dvdcompare.net/comparisons/film.php?fid=${filmId}`,
      fl: "timestamp,original",
      filter: "statuscode:200",
      output: "json",
      limit: "-1",
    }).toString()}`,
  )
    .then((response) => response.text())
    .then(parseNewestCdxCapture)

const findAnyWaybackCapture = (filmId: string) =>
  findWaybackCapture(filmId).then((capture) =>
    capture === null
      ? findWaybackCdxCapture(filmId)
      : capture,
  )

export const fetchArchivedDvdComparePage = (
  requestedUrl: string,
): Promise<DvdComparePage> =>
  ((filmId: string | null) =>
    filmId === null
      ? Promise.reject(
          new Error(
            `The Wayback fallback only supports DVDCompare film pages: ${requestedUrl}`,
          ),
        )
      : findAnyWaybackCapture(filmId).then((capture) =>
          capture === null
            ? Promise.reject(
                new Error(
                  `The Wayback Machine has no DVDCompare capture for film id ${filmId}.`,
                ),
              )
            : ((replayUrl: string) =>
                fetchWaybackResponse(replayUrl)
                  .then((response) =>
                    decodeResponseText(response).then(
                      (html) => ({
                        html,
                        status: response.status,
                        url: requestedUrl,
                      }),
                    ),
                  )
                  .then(
                    (page) =>
                      logWarning(
                        "DVDCOMPARE ARCHIVE FALLBACK",
                        `DVDCompare could not be reached. Using its newest archived listing for film id ${filmId} (${capture.timestamp}).`,
                      ) ?? page,
                  ))(
                `${WAYBACK_REPLAY_BASE_URL}/${capture.timestamp}id_/${capture.originalUrl}`,
              ),
        ))(getDvdCompareFilmId(requestedUrl))

// DVDCompare's TLS listener has been failing since 2026-09-08 while the
// same Apache instance answers normally on plain HTTP. `https://` stays the
// first attempt so a run returns to it the moment the TLS fault is fixed;
// this is the twin URL tried once in between the live attempt and the
// archive. It returns null for any host that is not DVDCompare, so the
// downgrade can never be applied to another provider.
export const toInsecureDvdCompareUrl = (
  url: string,
): string | null =>
  ((parsedUrl: URL) =>
    parsedUrl.protocol === "https:" &&
    /^(?:www\.)?dvdcompare\.net$/i.test(parsedUrl.hostname)
      ? ((): string => {
          parsedUrl.protocol = "http:"
          return parsedUrl.toString()
        })()
      : null)(new URL(url))

// The insecure retry is a plain fetch rather than another `cachedFetch`
// call: the answer belongs under the ORIGINAL https request key, exactly
// as the archived body does. Caching it under the http URL would make
// every later run fail against https before finding the separate row.
export const fetchInsecureDvdComparePage = (
  requestedUrl: string,
  initialization?: RequestInit,
): Promise<DvdComparePage> =>
  ((insecureUrl: string | null) =>
    insecureUrl === null
      ? Promise.reject(
          new Error(
            `Not a DVDCompare https URL: ${requestedUrl}`,
          ),
        )
      : fetch(insecureUrl, {
          ...initialization,
          headers: {
            ...initialization?.headers,
            "User-Agent": DVDCOMPARE_USER_AGENT,
          },
          signal: AbortSignal.timeout(
            WAYBACK_REQUEST_TIMEOUT_MILLISECONDS,
          ),
        })
          .then((response) =>
            response.ok
              ? decodeResponseText(response).then(
                  (html) => ({
                    html,
                    status: response.status,
                    // The POST-redirect landing URL decides
                    // `isDirectListing`, and it is matched on
                    // `film.php?fid=N`, so the http scheme is harmless.
                    url: response.url,
                  }),
                )
              : Promise.reject(
                  new Error(
                    `DVDCompare insecure retry failed with status ${response.status} for ${insecureUrl}`,
                  ),
                ),
          )
          .then(
            (page) =>
              logWarning(
                "DVDCOMPARE INSECURE FALLBACK",
                `DVDCompare could not be reached over https. Served ${requestedUrl} over http instead.`,
              ) ?? page,
          ))(toInsecureDvdCompareUrl(requestedUrl))

export const isDvdCompareNetworkFailure = (
  thrownError: unknown,
) =>
  thrownError instanceof TypeError ||
  /(?:ECONNREFUSED|ENETUNREACH|ETIMEDOUT|fetch failed|net::ERR_|connection timed out|TimeoutError|Timeout \d+ms exceeded)/i.test(
    thrownError instanceof Error
      ? thrownError.message
      : String(thrownError),
  )

const storeDvdComparePage = ({
  cache,
  initialization,
  page,
  url,
}: {
  cache: ProviderCache
  initialization: RequestInit | undefined
  page: DvdComparePage
  url: string
}) =>
  Promise.resolve(
    cache.set({
      body: JSON.stringify(page),
      provider: DVDCOMPARE_PROVIDER,
      requestKey: buildCacheKey({ initialization, url }),
    }),
  ).then(() => page)

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
      })
        .then(({ body }) =>
          decodeDvdComparePage({ body, requestedUrl: url }),
        )
        .catch((thrownError: unknown) =>
          isDvdCompareNetworkFailure(thrownError)
            ? // The http twin is tried for POST as well as GET. That is
              // the only recovery that restores `search.php`, which the
              // archive cannot replay at all because it is POST-only.
              fetchInsecureDvdComparePage(
                url,
                initialization,
              )
                .then((page) =>
                  storeDvdComparePage({
                    cache,
                    initialization,
                    page,
                    url,
                  }),
                )
                .catch((insecureError: unknown) =>
                  (initialization?.method ?? "GET") ===
                  "GET"
                    ? fetchArchivedDvdComparePage(url).then(
                        (page) =>
                          storeDvdComparePage({
                            cache,
                            initialization,
                            page,
                            url,
                          }),
                      )
                    : Promise.reject(insecureError),
                )
            : Promise.reject(thrownError),
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
