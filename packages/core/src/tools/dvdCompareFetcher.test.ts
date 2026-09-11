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

  test("loads the newest archived film page and caches it under the live URL", async () => {
    const archivedHtml =
      "<html><title>DVD Compare: Soldier (Blu-ray) (1998)</title><body>archived film</body></html>"
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      // The https attempt and the http twin both fail: DVDCompare is
      // unreachable on either scheme, which is the only state that should
      // reach the archive.
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            archived_snapshots: {
              closest: {
                timestamp: "20250403175037",
                url: "http://web.archive.org/web/20250403175037/https://dvdcompare.net/comparisons/film.php?fid=74759",
              },
            },
            url: "https://dvdcompare.net/comparisons/film.php?fid=74759",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(archivedHtml, { status: 200 }),
      )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cache = openMemoryCache()
    const fetchPage = createDvdComparePageFetcher({
      cache,
      minimumRequestIntervalMilliseconds: 0,
    })

    const archivedPage = await fetchPage(FILM_URL)

    expect(archivedPage).toEqual({
      html: archivedHtml,
      status: 200,
      url: FILM_URL,
    })
    expect(
      cache.get({
        provider: DVDCOMPARE_PROVIDER,
        requestKey: FILM_URL,
      }),
    ).not.toBeNull()

    const cachedPage = await fetchPage(FILM_URL)

    expect(cachedPage).toEqual(archivedPage)
    expect(fetchSpy).toHaveBeenCalledTimes(4)
    expect(String(fetchSpy.mock.calls[2]?.[0])).toContain(
      "archive.org/wayback/available",
    )
    expect(String(fetchSpy.mock.calls[3]?.[0])).toBe(
      "https://web.archive.org/web/20250403175037id_/https://dvdcompare.net/comparisons/film.php?fid=74759",
    )
  })

  test("retries a failed search POST over http but never sends it to the archive", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await expect(
      fetchPage(SEARCH_URL, {
        body: "param=Soldier&searchtype=text",
        method: "POST",
      }),
    ).rejects.toThrow("fetch failed")
    // https, then the http twin — and then it stops. The archive cannot
    // replay a POST, so no archive.org request is made.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(
      (fetchSpy.mock.calls as unknown[][]).every((call) =>
        String(call[0]).includes("dvdcompare.net"),
      ),
    ).toBe(true)
  })

  test("tries another archived host form when the first form has no capture", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      // The https attempt and the http twin both fail: DVDCompare is
      // unreachable on either scheme, which is the only state that should
      // reach the archive.
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ archived_snapshots: {} }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            archived_snapshots: {
              closest: {
                timestamp: "20260121165805",
                url: "http://web.archive.org/web/20260121165805/https://dvdcompare.net/comparisons/film.php?fid=74759",
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html>second host form</html>", {
          status: 200,
        }),
      )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    expect((await fetchPage(FILM_URL)).html).toContain(
      "second host form",
    )
    expect(fetchSpy).toHaveBeenCalledTimes(5)
    expect(
      decodeURIComponent(
        String(fetchSpy.mock.calls[2]?.[0]),
      ),
    ).toContain(
      "url=https://www.dvdcompare.net/comparisons/film.php?fid=74759",
    )
    expect(
      decodeURIComponent(
        String(fetchSpy.mock.calls[3]?.[0]),
      ),
    ).toContain(
      "url=https://dvdcompare.net/comparisons/film.php?fid=74759",
    )
  })

  test("uses the CDX index when the availability endpoint omits an existing capture", async () => {
    const noCaptureResponse = () =>
      new Response(
        JSON.stringify({ archived_snapshots: {} }),
        { status: 200 },
      )
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      // The https attempt and the http twin both fail: DVDCompare is
      // unreachable on either scheme, which is the only state that should
      // reach the archive.
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(noCaptureResponse())
      .mockResolvedValueOnce(noCaptureResponse())
      .mockResolvedValueOnce(noCaptureResponse())
      .mockResolvedValueOnce(noCaptureResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            ["timestamp", "original"],
            [
              "20240827221619",
              "https://dvdcompare.net/comparisons/film.php?fid=74759",
            ],
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html>indexed capture</html>", {
          status: 200,
        }),
      )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    expect((await fetchPage(FILM_URL)).html).toContain(
      "indexed capture",
    )
    expect(fetchSpy).toHaveBeenCalledTimes(8)
    expect(String(fetchSpy.mock.calls[6]?.[0])).toContain(
      "web.archive.org/cdx/search/cdx",
    )
    expect(String(fetchSpy.mock.calls[7]?.[0])).toBe(
      "https://web.archive.org/web/20240827221619id_/https://dvdcompare.net/comparisons/film.php?fid=74759",
    )
  })

  test("rejects when both dvdcompare.net and its archive are unreachable", async () => {
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

  // DVDCompare's TLS listener failed from 2026-09-08 while port 80 kept
  // answering in about a second. Before this, an https transport failure
  // went straight to the Wayback Machine and a search could not recover
  // at all, because search.php is POST-only and the archive cannot
  // replay a POST.
  test("retries a failed https GET over http and caches it under the https key", async () => {
    const requestedUrls: string[] = []
    const fetchSpy = vi.fn(async (url: string) => {
      requestedUrls.push(url)
      if (url.startsWith("https://")) {
        throw new TypeError("fetch failed")
      }
      return buildHtmlResponse({
        html: "<html>film over http</html>",
        url,
      })
    })
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cache = openMemoryCache()
    const fetchPage = createDvdComparePageFetcher({
      cache,
      minimumRequestIntervalMilliseconds: 0,
    })

    const page = await fetchPage(FILM_URL)

    expect(page.html).toBe("<html>film over http</html>")
    expect(requestedUrls[0]).toBe(FILM_URL)
    expect(requestedUrls[1]).toBe(
      "http://www.dvdcompare.net/comparisons/film.php?fid=74759",
    )

    // Stored under the https key, so the next run does not have to fail
    // against https again before finding a separate http row.
    expect(
      cache.get({
        provider: DVDCOMPARE_PROVIDER,
        requestKey: FILM_URL,
      }),
    ).not.toBeNull()
  })

  test("retries a failed https search POST over http, which the archive cannot replay", async () => {
    const attempts: { body: unknown; url: string }[] = []
    const fetchSpy = vi.fn(
      async (url: string, initialization?: RequestInit) => {
        attempts.push({
          body: initialization?.body,
          url,
        })
        if (url.startsWith("https://")) {
          throw new TypeError("fetch failed")
        }
        return buildHtmlResponse({
          html: "<html>search results</html>",
          url,
        })
      },
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    const page = await fetchPage(SEARCH_URL, {
      body: "param=Eyes+Wide+Shut&searchtype=text",
      method: "POST",
    })

    expect(page.html).toBe("<html>search results</html>")
    // The POST body survives the downgrade, or the retry would search
    // for nothing and silently return the front page.
    expect(attempts[1]).toEqual({
      body: "param=Eyes+Wide+Shut&searchtype=text",
      url: "http://www.dvdcompare.net/comparisons/search.php",
    })
  })

  test("does not downgrade a host that is not DVDCompare", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const fetchPage = createDvdComparePageFetcher({
      cache: openMemoryCache(),
      minimumRequestIntervalMilliseconds: 0,
    })

    await expect(
      fetchPage(
        "https://example.com/comparisons/film.php?fid=1",
      ),
    ).rejects.toThrow()

    expect(
      (fetchSpy.mock.calls as unknown[][]).every((call) =>
        String(call[0]).startsWith("https://"),
      ),
    ).toBe(true)
  })
})
