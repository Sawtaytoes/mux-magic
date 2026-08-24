import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  openProviderCache,
  PROVIDER_CACHE_TIME_TO_LIVE,
} from "./providerCache.js"

// `node:sqlite` opens the database file in C++, below the memfs shim the
// core setup installs, so these tests need the real filesystem for both
// halves of the round trip.
vi.unmock("node:fs")
vi.unmock("node:fs/promises")

const millisecondsPerDay = 24 * 60 * 60 * 1000

describe(openProviderCache.name, () => {
  const directoryHolder = { current: "" }

  beforeAll(async () => {
    directoryHolder.current = await mkdtemp(
      join(tmpdir(), "provider-cache-"),
    )
  })

  afterAll(async () => {
    await rm(directoryHolder.current, {
      force: true,
      recursive: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const openTemporaryCache = ({
    fileName,
    timeToLiveByProvider = PROVIDER_CACHE_TIME_TO_LIVE,
  }: {
    fileName: string
    timeToLiveByProvider?: Record<string, number>
  }) =>
    openProviderCache({
      databasePath: join(directoryHolder.current, fileName),
      timeToLiveByProvider,
    })

  test("round-trips a stored body, etag and timestamp", () => {
    const cache = openTemporaryCache({
      fileName: "round-trip.sqlite",
    })

    cache.set({
      body: '{"releases":[]}',
      etag: 'W/"abc123"',
      provider: "musicBrainz",
      requestKey:
        "https://example.test/ws/2/release?query=x",
    })

    const row = cache.get({
      provider: "musicBrainz",
      requestKey:
        "https://example.test/ws/2/release?query=x",
    })

    expect(row?.body).toBe('{"releases":[]}')
    expect(row?.etag).toBe('W/"abc123"')
    expect(typeof row?.fetchedAt).toBe("number")
    expect(cache.isAvailable).toBe(true)

    cache.close()
  })

  test("misses when the row is older than the provider's time to live", () => {
    const cache = openTemporaryCache({
      fileName: "expiry.sqlite",
      timeToLiveByProvider: {
        dvdCompare: 7 * millisecondsPerDay,
      },
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    cache.set({
      body: "<html>disc</html>",
      provider: "dvdCompare",
      requestKey: "https://example.test/disc",
    })

    vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"))
    expect(
      cache.get({
        provider: "dvdCompare",
        requestKey: "https://example.test/disc",
      }),
    ).not.toBeNull()

    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"))
    expect(
      cache.get({
        provider: "dvdCompare",
        requestKey: "https://example.test/disc",
      }),
    ).toBeNull()

    cache.close()
  })

  test("getStale keeps the expired row so its etag can drive a conditional request", () => {
    const cache = openTemporaryCache({
      fileName: "stale.sqlite",
      timeToLiveByProvider: { aniDb: 0 },
    })

    cache.set({
      body: "<anime/>",
      etag: '"anidb-etag"',
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=1",
    })

    expect(
      cache.get({
        provider: "aniDb",
        requestKey: "https://example.test/anime?aid=1",
      }),
    ).toBeNull()

    const staleRow = cache.getStale({
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=1",
    })

    expect(staleRow?.body).toBe("<anime/>")
    expect(staleRow?.etag).toBe('"anidb-etag"')

    cache.close()
  })

  test("applies a per-provider time to live and falls back to the default", () => {
    const cache = openTemporaryCache({
      fileName: "per-provider.sqlite",
      timeToLiveByProvider: { impatientProvider: 0 },
    })

    cache.set({
      body: "impatient",
      provider: "impatientProvider",
      requestKey: "https://example.test/one",
    })
    cache.set({
      body: "unlisted",
      provider: "unlistedProvider",
      requestKey: "https://example.test/two",
    })

    expect(
      cache.get({
        provider: "impatientProvider",
        requestKey: "https://example.test/one",
      }),
    ).toBeNull()
    expect(
      cache.get({
        provider: "unlistedProvider",
        requestKey: "https://example.test/two",
      })?.body,
    ).toBe("unlisted")

    cache.close()
  })

  test("deleteProvider drops one provider's rows and leaves the rest", () => {
    const cache = openTemporaryCache({
      fileName: "delete-provider.sqlite",
    })

    cache.set({
      body: "mb",
      provider: "musicBrainz",
      requestKey: "https://example.test/mb",
    })
    cache.set({
      body: "caa",
      provider: "coverArtArchive",
      requestKey: "https://example.test/caa",
    })

    cache.deleteProvider("musicBrainz")

    expect(
      cache.getStale({
        provider: "musicBrainz",
        requestKey: "https://example.test/mb",
      }),
    ).toBeNull()
    expect(
      cache.getStale({
        provider: "coverArtArchive",
        requestKey: "https://example.test/caa",
      })?.body,
    ).toBe("caa")

    cache.clear()

    expect(
      cache.getStale({
        provider: "coverArtArchive",
        requestKey: "https://example.test/caa",
      }),
    ).toBeNull()

    cache.close()
  })

  test("re-reads what an earlier handle wrote to the same file", () => {
    const firstHandle = openTemporaryCache({
      fileName: "persisted.sqlite",
    })
    firstHandle.set({
      body: "persisted",
      provider: "vgmdb",
      requestKey: "https://example.test/album/1",
    })
    firstHandle.close()

    const secondHandle = openTemporaryCache({
      fileName: "persisted.sqlite",
    })

    expect(
      secondHandle.get({
        provider: "vgmdb",
        requestKey: "https://example.test/album/1",
      })?.body,
    ).toBe("persisted")

    secondHandle.close()
  })

  test("degrades to a null-object handle when the database cannot be opened", () =>
    captureConsoleMessage("error", (consoleSpy) => {
      const cache = openProviderCache({
        databasePath: directoryHolder.current,
      })

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      expect(cache.isAvailable).toBe(false)

      expect(() => {
        cache.set({
          body: "anything",
          provider: "musicBrainz",
          requestKey: "https://example.test/mb",
        })
      }).not.toThrow()

      expect(
        cache.get({
          provider: "musicBrainz",
          requestKey: "https://example.test/mb",
        }),
      ).toBeNull()
      expect(
        cache.getStale({
          provider: "musicBrainz",
          requestKey: "https://example.test/mb",
        }),
      ).toBeNull()

      expect(() => {
        cache.deleteProvider("musicBrainz")
        cache.clear()
        cache.close()
      }).not.toThrow()

      expect(consoleSpy).toHaveBeenCalledTimes(1)
    }))
})
