import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { openProviderCache } from "../provider-cache/providerCache.js"
import {
  createDvdComparePageFetcher,
  DVDCOMPARE_PROVIDER,
  DVDCOMPARE_USER_AGENT,
} from "./dvdCompareFetcher.js"

// The regression this file exists for: `dvdCompare` was declared in
// PROVIDER_CACHE_TIME_TO_LIVE from the day the cache landed, but no code
// ever fetched through the cache, so the table held rows for the four
// music providers and zero for DVDCompare. Every disc ingest went to the
// network, and the 2026-09-05 outage failed every one of them.

const FILM_URL =
  "https://www.dvdcompare.net/comparisons/film.php?fid=74759"
const SEARCH_URL =
  "https://www.dvdcompare.net/comparisons/search.php"

const buildResponse = ({
  bytes,
  url = FILM_URL,
}: {
  bytes: Uint8Array
  url?: string
}) => ({
  arrayBuffer: async () => bytes.buffer,
  headers: { get: () => null },
  ok: true,
  status: 200,
  url,
})

const buildHtmlResponse = ({
  html,
  url = FILM_URL,
}: {
  html: string
  url?: string
}) =>
  buildResponse({
    bytes: new TextEncoder().encode(html),
    url,
  })

// An in-memory database keeps the real cache implementation — the same
// `node:sqlite` table, the same freshness rule — while giving every test a
// cold start and touching no file.
const openMemoryCache = (
  timeToLiveByProvider: Record<string, number> = {
    [DVDCOMPARE_PROVIDER]: 7 * 24 * 60 * 60 * 1000,
  },
) =>
  openProviderCache({
    databasePath: ":memory:",
    timeToLiveByProvider,
  })

describe(createDvdComparePageFetcher.name, () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("writes a dvdCompare row on the first read and serves the second read from it", async () => {
    const fetchSpy = vi.fn(async () =>
      buildHtmlResponse({ html: "<html>film</html>" }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cache = openMemoryCache()
    const fetchPage = createDvdComparePageFetcher({
      cache,
      minimumRequestIntervalMilliseconds: 0,
    })

    const first = await fetchPage(FILM_URL)

    // The row the defect was missing.
    expect(
      cache.get({
        provider: DVDCOMPARE_PROVIDER,
        requestKey: FILM_URL,
      }),
    ).not.toBeNull()

    const second = await fetchPage(FILM_URL)

    expect(second).toEqual(first)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test("keys a search POST on its body, so two search terms do not share one answer", async () => {
    const fetchSpy = vi.fn(async () =>
      buildHtmlResponse({
        html: "<html>results</html>",
        url: SEARCH_URL,
      }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await fetchPage(SEARCH_URL, {
      body: "param=Soldier&searchtype=text",
      method: "POST",
    })
    await fetchPage(SEARCH_URL, {
      body: "param=Coraline&searchtype=text",
      method: "POST",
    })
    await fetchPage(SEARCH_URL, {
      body: "param=Soldier&searchtype=text",
      method: "POST",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test("sends the browser User-Agent DVDCompare requires", async () => {
    const fetchSpy = vi.fn(async () =>
      buildHtmlResponse({ html: "<html>film</html>" }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await fetchPage(FILM_URL)

    const headers = (
      fetchSpy.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ]
    )[1].headers as Record<string, string>
    expect(headers["User-Agent"]).toBe(
      DVDCOMPARE_USER_AGENT,
    )
  })

  test("keeps the post-redirect landing URL and the status across a cache hit", async () => {
    const fetchSpy = vi.fn(async () =>
      buildHtmlResponse({
        html: "<html>film</html>",
        url: `${FILM_URL}&landed=1`,
      }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await fetchPage(SEARCH_URL)
    const cached = await fetchPage(SEARCH_URL)

    // Without the envelope the cached read would report SEARCH_URL and
    // `isDirectListing` would flip to false on every cached search.
    expect(cached.url).toBe(`${FILM_URL}&landed=1`)
    expect(cached.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test("recovers Windows-1252 bytes that DVDCompare mislabels as UTF-8", async () => {
    // 0x92 is a Windows-1252 right single quote and invalid UTF-8, so a
    // strict decoder throws and the chardet fallback takes over. Reading
    // through Response.text() would have produced U+FFFD instead.
    const fetchSpy = vi.fn(async () =>
      buildResponse({
        bytes: Uint8Array.from([
          0x49, 0x74, 0x92, 0x73, 0x20, 0x68, 0x65, 0x72,
          0x65, 0x2e, 0x20, 0x41, 0x20, 0x6c, 0x6f, 0x6e,
          0x67, 0x65, 0x72, 0x20, 0x6c, 0x69, 0x6e, 0x65,
          0x20, 0x6f, 0x66, 0x20, 0x74, 0x65, 0x78, 0x74,
          0x2e,
        ]),
      }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    const page = await fetchPage(FILM_URL)
    const cachedPage = await fetchPage(FILM_URL)

    expect(page.html).toContain("It’s here.")
    expect(cachedPage.html).toBe(page.html)
  })

  test("serves the expired row when dvdcompare.net is unreachable", async () => {
    // The 2026-09-05 failure, reproduced: the answer is on disk, past its
    // time to live, and undici throws `TypeError: fetch failed`. A plain
    // time-to-live cache re-raises that and blocks the ingest.
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        buildHtmlResponse({ html: "<html>film</html>" }),
      )
      .mockRejectedValue(new TypeError("fetch failed"))
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    // Zero milliseconds of life, so the row is already expired on the
    // second read.
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache({ [DVDCOMPARE_PROVIDER]: 0 }),
      minimumRequestIntervalMilliseconds: 0,
    })

    const fresh = await fetchPage(FILM_URL)
    const stale = await fetchPage(FILM_URL)

    expect(stale.html).toBe(fresh.html)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test("rejects when dvdcompare.net is unreachable and nothing was ever cached", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    ) as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await expect(fetchPage(FILM_URL)).rejects.toThrow(
      "fetch failed",
    )
  })
})
