import { withLoggingContext } from "@mux-magic/tools"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { createCachedFetch } from "./cachedFetch.js"
import {
  openProviderCache,
  type ProviderCache,
} from "./providerCache.js"
import {
  type ProviderCacheFallback,
  registerProviderCacheFallbackListener,
} from "./providerCacheFallbacks.js"
import {
  PROVIDER_CIRCUIT_COOLDOWN_MILLISECONDS,
  ProviderSkippedError,
} from "./providerCircuitBreaker.js"

const userAgent =
  "mux-magic/1.0.0 ( https://example.test/contact )"

const millisecondsPerHour = 60 * 60 * 1000

// The real table in memory, with the real policy: every provider here is
// network-first except AniDB, which keeps a one-day window.
const openMemoryCache = () =>
  openProviderCache({ databasePath: ":memory:" })

const buildCachedFetch = ({
  cache,
  provider = "musicBrainz",
  timeoutMilliseconds,
}: {
  cache: ProviderCache
  provider?: "aniDb" | "movieDb" | "musicBrainz"
  timeoutMilliseconds?: number
}) =>
  createCachedFetch({
    cache,
    minimumRequestIntervalMilliseconds: 0,
    provider,
    retryBackoffMilliseconds: 0,
    timeoutMilliseconds,
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

const installFetch = (
  fetchSpy: ReturnType<typeof vi.fn>,
) => {
  globalThis.fetch =
    fetchSpy as unknown as typeof globalThis.fetch
}

// A request that never answers on its own and fails only when its signal
// aborts — a provider that accepted the connection and went quiet.
const fetchThatNeverAnswers = () =>
  vi.fn(
    (_url: string, initialization: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        initialization.signal?.addEventListener(
          "abort",
          () => {
            reject(initialization.signal?.reason)
          },
        )
      }),
  )

const collectFallbacks = () =>
  ((fallbacks: ProviderCacheFallback[]) => ({
    fallbacks,
    unregister: registerProviderCacheFallbackListener(
      (fallback) => {
        fallbacks.push(fallback)
      },
    ),
  }))([])

describe(createCachedFetch.name, () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── network-first ─────────────────────────────────────────────────────

  test("asks the provider on every read and returns the fresh answer even when a row exists", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("old answer", { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response("new answer", { status: 200 }),
      )
    installFetch(fetchSpy)
    const cache = openMemoryCache()
    const cachedFetch = buildCachedFetch({ cache })

    await cachedFetch("https://example.test/ws/2/release/1")
    const second = await cachedFetch(
      "https://example.test/ws/2/release/1",
    )

    expect(second).toEqual({
      body: "new answer",
      isFromCache: false,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(
      cache.getStale({
        provider: "musicBrainz",
        requestKey: "https://example.test/ws/2/release/1",
      })?.body,
    ).toBe("new answer")
  })

  test("revalidates with If-None-Match and treats a 304 as the latest, not as a fallback", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: '{"ok":true}',
      etag: '"one"',
      provider: "musicBrainz",
      requestKey: "https://example.test/ws/2/release/1",
    })
    const fetchSpy = vi.fn(
      async () => new Response(null, { status: 304 }),
    )
    installFetch(fetchSpy)
    const { fallbacks, unregister } = collectFallbacks()

    const revalidated = await buildCachedFetch({ cache })(
      "https://example.test/ws/2/release/1",
    )
    unregister()

    expect(revalidated).toEqual({
      body: '{"ok":true}',
      isFromCache: true,
    })
    expect(
      headersOfCall({ callIndex: 0, fetchSpy })[
        "If-None-Match"
      ],
    ).toBe('"one"')
    expect(fallbacks).toEqual([])
  })

  test("rejects a 404 with the provider, status and url, and caches nothing", async () => {
    installFetch(
      vi.fn(
        async () => new Response("nope", { status: 404 }),
      ),
    )
    const cache = openMemoryCache()

    await expect(
      buildCachedFetch({ cache })(
        "https://example.test/ws/2/release/404",
      ),
    ).rejects.toThrow(
      "musicBrainz request failed with status 404 for https://example.test/ws/2/release/404",
    )
    expect(
      cache.getStale({
        provider: "musicBrainz",
        requestKey: "https://example.test/ws/2/release/404",
      }),
    ).toBeNull()
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
    installFetch(fetchSpy)

    expect(
      await buildCachedFetch({ cache: openMemoryCache() })(
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
    installFetch(fetchSpy)

    await expect(
      buildCachedFetch({ cache: openMemoryCache() })(
        "https://example.test/ws/2/release/3",
      ),
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
    installFetch(fetchSpy)

    await buildCachedFetch({ cache: openMemoryCache() })(
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

  // ── fallback on failure ───────────────────────────────────────────────

  test("serves the stored row, flags it and reports it when the provider cannot be reached", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: "first body",
      fetchedAt: Date.now() - 3 * millisecondsPerHour,
      provider: "musicBrainz",
      requestKey: "https://example.test/ws/2/release/5",
    })
    installFetch(
      vi.fn(() =>
        Promise.reject(new TypeError("fetch failed")),
      ),
    )
    const { fallbacks, unregister } = collectFallbacks()

    const outcome = await buildCachedFetch({ cache })(
      "https://example.test/ws/2/release/5",
    )
    unregister()

    expect(outcome).toEqual({
      body: "first body",
      isCacheFallback: true,
      isFromCache: true,
    })
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({
      cause: "fetch failed",
      isProviderSkipped: false,
      provider: "musicBrainz",
      request: "https://example.test/ws/2/release/5",
    })
    expect(
      fallbacks[0]?.ageMilliseconds,
    ).toBeGreaterThanOrEqual(3 * millisecondsPerHour)
  })

  test("falls back on a non-2xx answer too", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: "stored",
      provider: "musicBrainz",
      requestKey: "https://example.test/ws/2/release/6",
    })
    installFetch(
      vi.fn(
        async () => new Response("gone", { status: 404 }),
      ),
    )

    expect(
      await buildCachedFetch({ cache })(
        "https://example.test/ws/2/release/6",
      ),
    ).toEqual({
      body: "stored",
      isCacheFallback: true,
      isFromCache: true,
    })
  })

  test("still rejects when the provider is unreachable and nothing was ever cached", async () => {
    installFetch(
      vi.fn(() =>
        Promise.reject(new TypeError("fetch failed")),
      ),
    )

    await expect(
      buildCachedFetch({ cache: openMemoryCache() })(
        "https://example.test/ws/2/release/7",
      ),
    ).rejects.toThrow("fetch failed")
  })

  test("uses the injected decoder for the stored body", async () => {
    installFetch(
      vi.fn(
        async () => new Response("raw", { status: 200 }),
      ),
    )
    const cache = openMemoryCache()
    const cachedFetch = createCachedFetch({
      cache,
      decodeResponseBody: async (response) =>
        `decoded:${await response.text()}`,
      minimumRequestIntervalMilliseconds: 0,
      provider: "musicBrainz",
      retryBackoffMilliseconds: 0,
      userAgent,
    })

    expect(
      await cachedFetch(
        "https://example.test/ws/2/release/8",
      ),
    ).toEqual({ body: "decoded:raw", isFromCache: false })
    expect(
      cache.getStale({
        provider: "musicBrainz",
        requestKey: "https://example.test/ws/2/release/8",
      })?.body,
    ).toBe("decoded:raw")
  })

  test("a decoder that rejects a 200 makes it a failure: nothing stored, the old row served", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: "<anime id='1'/>",
      fetchedAt: Date.now() - 2 * 24 * millisecondsPerHour,
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=1",
    })
    installFetch(
      vi.fn(
        async () =>
          new Response("<error>Banned</error>", {
            status: 200,
          }),
      ),
    )
    const cachedFetch = createCachedFetch({
      cache,
      decodeResponseBody: (response) =>
        response
          .text()
          .then((body) =>
            body.includes("<error")
              ? Promise.reject(new Error(body))
              : body,
          ),
      minimumRequestIntervalMilliseconds: 0,
      provider: "aniDb",
      userAgent,
    })

    expect(
      await cachedFetch("https://example.test/anime?aid=1"),
    ).toEqual({
      body: "<anime id='1'/>",
      isCacheFallback: true,
      isFromCache: true,
    })
    expect(
      cache.getStale({
        provider: "aniDb",
        requestKey: "https://example.test/anime?aid=1",
      })?.body,
    ).toBe("<anime id='1'/>")
  })

  // ── the AniDB exception ───────────────────────────────────────────────

  test("AniDB: an entry younger than a day is served with no request", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: "<anime id='2'/>",
      fetchedAt: Date.now() - 23 * millisecondsPerHour,
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=2",
    })
    const fetchSpy = vi.fn()
    installFetch(fetchSpy)

    expect(
      await buildCachedFetch({ cache, provider: "aniDb" })(
        "https://example.test/anime?aid=2",
      ),
    ).toEqual({
      body: "<anime id='2'/>",
      isCacheFallback: false,
      isFromCache: true,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("AniDB: an entry older than a day is network-first like every other provider", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: "<anime id='3' old/>",
      fetchedAt: Date.now() - 25 * millisecondsPerHour,
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=3",
    })
    const fetchSpy = vi.fn(
      async () =>
        new Response("<anime id='3' new/>", {
          status: 200,
        }),
    )
    installFetch(fetchSpy)

    expect(
      await buildCachedFetch({ cache, provider: "aniDb" })(
        "https://example.test/anime?aid=3",
      ),
    ).toEqual({
      body: "<anime id='3' new/>",
      isFromCache: false,
    })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  // ── timeouts ──────────────────────────────────────────────────────────

  test("a request that outlasts its timeout falls back to the stored row", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: '{"results":[]}',
      provider: "movieDb",
      requestKey: "https://example.test/3/search/movie",
    })
    installFetch(fetchThatNeverAnswers())

    expect(
      await buildCachedFetch({
        cache,
        provider: "movieDb",
        timeoutMilliseconds: 20,
      })("https://example.test/3/search/movie"),
    ).toEqual({
      body: '{"results":[]}',
      isCacheFallback: true,
      isFromCache: true,
    })
  })

  test("a timeout with nothing stored rejects with the provider, the bound and the url", async () => {
    installFetch(fetchThatNeverAnswers())

    await expect(
      buildCachedFetch({
        cache: openMemoryCache(),
        provider: "movieDb",
        timeoutMilliseconds: 20,
      })("https://example.test/3/movie/1"),
    ).rejects.toMatchObject({
      message:
        "movieDb request timed out after 20 ms for https://example.test/3/movie/1",
      name: "TimeoutError",
    })
  })

  // ── the per-job circuit ───────────────────────────────────────────────

  test("after one unreachable failure, the rest of the job goes straight to the cache", async () => {
    const cache = openMemoryCache()
    ;["a", "b"].forEach((releaseId) => {
      cache.set({
        body: `stored ${releaseId}`,
        provider: "musicBrainz",
        requestKey: `https://example.test/ws/2/release/${releaseId}`,
      })
    })
    const fetchSpy = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    )
    installFetch(fetchSpy)
    const cachedFetch = buildCachedFetch({ cache })
    const { fallbacks, unregister } = collectFallbacks()

    const outcomes = await withLoggingContext(
      { jobId: "job-circuit" },
      () =>
        cachedFetch(
          "https://example.test/ws/2/release/a",
        ).then((first) =>
          cachedFetch(
            "https://example.test/ws/2/release/b",
          ).then((second) => [first, second]),
        ),
    )
    unregister()

    expect(outcomes.map(({ body }) => body)).toEqual([
      "stored a",
      "stored b",
    ])
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(
      fallbacks.map(
        ({ isProviderSkipped }) => isProviderSkipped,
      ),
    ).toEqual([false, true])
  })

  test("with the circuit open and nothing stored, fails at once without a request", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    )
    installFetch(fetchSpy)
    const cachedFetch = buildCachedFetch({
      cache: openMemoryCache(),
    })

    await withLoggingContext({ jobId: "job-empty" }, () =>
      expect(
        cachedFetch("https://example.test/ws/2/release/c"),
      )
        .rejects.toThrow("fetch failed")
        .then(() =>
          expect(
            cachedFetch(
              "https://example.test/ws/2/release/d",
            ),
          ).rejects.toBeInstanceOf(ProviderSkippedError),
        ),
    )
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  test("a 404 does not open the circuit", async () => {
    const fetchSpy = vi.fn(
      async () => new Response("nope", { status: 404 }),
    )
    installFetch(fetchSpy)
    const cachedFetch = buildCachedFetch({
      cache: openMemoryCache(),
    })

    await withLoggingContext({ jobId: "job-404" }, () =>
      Promise.allSettled([
        cachedFetch("https://example.test/ws/2/release/e"),
      ]).then(() =>
        Promise.allSettled([
          cachedFetch(
            "https://example.test/ws/2/release/f",
          ),
        ]),
      ),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test("another job still asks the provider", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response("back up", { status: 200 }),
      )
    installFetch(fetchSpy)
    const cachedFetch = buildCachedFetch({
      cache: openMemoryCache(),
    })

    await withLoggingContext({ jobId: "job-one" }, () =>
      Promise.allSettled([
        cachedFetch("https://example.test/ws/2/release/g"),
      ]),
    )
    const outcome = await withLoggingContext(
      { jobId: "job-two" },
      () =>
        cachedFetch("https://example.test/ws/2/release/g"),
    )

    expect(outcome.body).toBe("back up")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test("the circuit lets a probe through after its cooldown", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z"))
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response("back up", { status: 200 }),
      )
    installFetch(fetchSpy)
    const cachedFetch = buildCachedFetch({
      cache: openMemoryCache(),
    })

    await withLoggingContext({ jobId: "job-probe" }, () =>
      Promise.allSettled([
        cachedFetch("https://example.test/ws/2/release/h"),
      ]),
    )
    vi.setSystemTime(
      Date.now() +
        PROVIDER_CIRCUIT_COOLDOWN_MILLISECONDS +
        1,
    )
    const outcome = await withLoggingContext(
      { jobId: "job-probe" },
      () =>
        cachedFetch("https://example.test/ws/2/release/h"),
    )

    expect(outcome.body).toBe("back up")
  })

  // ── the table is the check ────────────────────────────────────────────

  test("refuses, at compile time, a provider the policy table does not name", () => {
    const buildUnnamedFetcher = () =>
      createCachedFetch({
        cache: openMemoryCache(),
        // @ts-expect-error — `vgmdb` is the dead key the old table had while
        // the fetcher was registered as `vgmdbCddb`.
        provider: "vgmdb",
        userAgent,
      })

    expect(typeof buildUnnamedFetcher).toBe("function")
  })
})
