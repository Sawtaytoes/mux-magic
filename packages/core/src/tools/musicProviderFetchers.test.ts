import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("reuses one fetcher per provider so the rate limiter survives", async () => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/0.0.0 ( test@example.com )",
  )
  const createCachedFetch = vi.fn(
    (_options: {
      minimumRequestIntervalMilliseconds: number
      provider: string
    }) =>
      vi.fn(async () => ({
        body: "{}",
        isFromCache: true,
      })),
  )
  vi.doMock("../provider-cache/cachedFetch.js", () => ({
    createCachedFetch,
  }))
  vi.doMock("../provider-cache/providerCache.js", () => ({
    openProviderCache: () => ({ close: () => {} }),
    providerCacheDatabasePath: "/tmp/unused.sqlite",
  }))

  const { musicBrainzCachedFetch } = await import(
    "./musicProviderFetchers.js"
  )
  await musicBrainzCachedFetch(
    "https://musicbrainz.org/ws/2/release/a",
  )
  await musicBrainzCachedFetch(
    "https://musicbrainz.org/ws/2/release/b",
  )
  await musicBrainzCachedFetch(
    "https://musicbrainz.org/ws/2/release/c",
  )

  expect(createCachedFetch).toHaveBeenCalledTimes(1)
  expect(
    createCachedFetch.mock.calls[0]?.[0],
  ).toMatchObject({
    minimumRequestIntervalMilliseconds: 1000,
    provider: "musicBrainz",
  })
})

test("each provider gets its own fetcher and its own interval", async () => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/0.0.0 ( test@example.com )",
  )
  const createCachedFetch = vi.fn(
    (_options: {
      minimumRequestIntervalMilliseconds: number
      provider: string
    }) =>
      vi.fn(async () => ({
        body: "{}",
        isFromCache: true,
      })),
  )
  vi.doMock("../provider-cache/cachedFetch.js", () => ({
    createCachedFetch,
  }))
  vi.doMock("../provider-cache/providerCache.js", () => ({
    openProviderCache: () => ({ close: () => {} }),
    providerCacheDatabasePath: "/tmp/unused.sqlite",
  }))

  const { coverArtCachedFetch, musicBrainzCachedFetch } =
    await import("./musicProviderFetchers.js")
  await musicBrainzCachedFetch(
    "https://musicbrainz.org/ws/2/release/a",
  )
  await coverArtCachedFetch(
    "https://coverartarchive.org/release/a",
  )

  expect(createCachedFetch).toHaveBeenCalledTimes(2)
  const providers = createCachedFetch.mock.calls.map(
    (call) => call[0].provider,
  )
  expect(providers).toEqual([
    "musicBrainz",
    "coverArtArchive",
  ])
})
