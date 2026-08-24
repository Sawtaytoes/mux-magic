import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { createCachedFetch } from "./cachedFetch.js"
import type {
  ProviderCache,
  ProviderCacheRow,
} from "./providerCache.js"

const userAgent =
  "mux-magic/1.0.0 ( https://example.test/contact )"

// An in-memory stand-in for the SQLite handle. `isEverythingStale` makes
// the freshness decision explicit instead of leaning on wall-clock time.
const createMemoryCache = () =>
  ((
    rows: Map<string, ProviderCacheRow>,
    staleHolder: { isEverythingStale: boolean },
  ) => ({
    clear: () => {
      rows.clear()
    },
    close: () => {},
    deleteProvider: () => {},
    get: ({
      provider,
      requestKey,
    }: {
      provider: string
      requestKey: string
    }) =>
      staleHolder.isEverythingStale
        ? null
        : (rows.get(`${provider} ${requestKey}`) ?? null),
    getStale: ({
      provider,
      requestKey,
    }: {
      provider: string
      requestKey: string
    }) => rows.get(`${provider} ${requestKey}`) ?? null,
    isAvailable: true,
    rows,
    set: ({
      body,
      etag = null,
      provider,
      requestKey,
    }: {
      body: string
      etag?: string | null
      provider: string
      requestKey: string
    }) => {
      rows.set(`${provider} ${requestKey}`, {
        body,
        etag,
        fetchedAt: Date.now(),
      })
    },
    staleHolder,
  }))(new Map(), { isEverythingStale: false })

const buildCachedFetch = (cache: ProviderCache) =>
  createCachedFetch({
    cache,
    minimumRequestIntervalMilliseconds: 0,
    provider: "musicBrainz",
    retryBackoffMilliseconds: 0,
    userAgent,
  })

const headersOfCall = ({
  callIndex,
  fetchSpy,
}: {
  callIndex: number
  fetchSpy: ReturnType<typeof vi.fn>
}) =>
  (
    fetchSpy.mock.calls[callIndex] as unknown as [
      string,
      RequestInit,
    ]
  )[1].headers as Record<string, string>

describe(createCachedFetch.name, () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("serves the second identical call from the cache without touching the network", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          headers: { ETag: '"one"' },
          status: 200,
        }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cachedFetch = buildCachedFetch(
      createMemoryCache(),
    )

    const first = await cachedFetch(
      "https://example.test/ws/2/release/1",
    )
    const second = await cachedFetch(
      "https://example.test/ws/2/release/1",
    )

    expect(first).toEqual({
      body: '{"ok":true}',
      isFromCache: false,
    })
    expect(second).toEqual({
      body: '{"ok":true}',
      isFromCache: true,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test("sends If-None-Match from the stale row and treats 304 as a hit", async () => {
    const firstFetchSpy = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          headers: { ETag: '"one"' },
          status: 200,
        }),
    )
    globalThis.fetch =
      firstFetchSpy as unknown as typeof globalThis.fetch
    const cache = createMemoryCache()
    const cachedFetch = buildCachedFetch(cache)

    await cachedFetch("https://example.test/ws/2/release/1")

    cache.staleHolder.isEverythingStale = true

    const revalidationFetchSpy = vi.fn(
      async () => new Response(null, { status: 304 }),
    )
    globalThis.fetch =
      revalidationFetchSpy as unknown as typeof globalThis.fetch

    const revalidated = await cachedFetch(
      "https://example.test/ws/2/release/1",
    )

    expect(revalidated).toEqual({
      body: '{"ok":true}',
      isFromCache: true,
    })
    expect(
      headersOfCall({
        callIndex: 0,
        fetchSpy: revalidationFetchSpy,
      })["If-None-Match"],
    ).toBe('"one"')
  })

  test("rejects a 404 with the provider, status and url, and caches nothing", async () => {
    const fetchSpy = vi.fn(
      async () => new Response("nope", { status: 404 }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cache = createMemoryCache()
    const cachedFetch = buildCachedFetch(cache)

    await expect(
      cachedFetch("https://example.test/ws/2/release/404"),
    ).rejects.toThrow(
      "musicBrainz request failed with status 404 for https://example.test/ws/2/release/404",
    )
    expect(cache.rows.size).toBe(0)
  })

  test("retries a 429 with backoff and returns the eventual success", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', { status: 200 }),
      )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cachedFetch = buildCachedFetch(
      createMemoryCache(),
    )

    expect(
      await cachedFetch(
        "https://example.test/ws/2/release/2",
      ),
    ).toEqual({
      body: '{"ok":true}',
      isFromCache: false,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  test("gives up after three attempts when the provider keeps answering 503", async () => {
    const fetchSpy = vi.fn(
      async () => new Response("down", { status: 503 }),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cachedFetch = buildCachedFetch(
      createMemoryCache(),
    )

    await expect(
      cachedFetch("https://example.test/ws/2/release/3"),
    ).rejects.toThrow(
      "musicBrainz request failed with status 503 for https://example.test/ws/2/release/3",
    )
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  test("puts the descriptive User-Agent on every request, including retries", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response("body", { status: 200 }),
      )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    const cachedFetch = buildCachedFetch(
      createMemoryCache(),
    )

    await cachedFetch(
      "https://example.test/ws/2/release/4",
      {
        headers: { Accept: "application/json" },
      },
    )

    expect(
      headersOfCall({ callIndex: 0, fetchSpy })[
        "User-Agent"
      ],
    ).toBe(userAgent)
    expect(
      headersOfCall({ callIndex: 1, fetchSpy })[
        "User-Agent"
      ],
    ).toBe(userAgent)
    expect(
      headersOfCall({ callIndex: 0, fetchSpy }).Accept,
    ).toBe("application/json")
  })
})
