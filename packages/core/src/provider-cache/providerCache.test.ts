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
  PROVIDER_CACHE_FRESH_WINDOW,
  PROVIDER_CACHE_POLICIES,
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
    freshWindowByProvider = PROVIDER_CACHE_FRESH_WINDOW,
  }: {
    fileName: string
    freshWindowByProvider?: Record<string, number>
  }) =>
    openProviderCache({
      databasePath: join(directoryHolder.current, fileName),
      freshWindowByProvider,
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

    const row = cache.getStale({
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

  test("get serves a row only inside the provider's fresh window", () => {
    const cache = openTemporaryCache({
      fileName: "fresh-window.sqlite",
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    cache.set({
      body: "<anime/>",
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=1",
    })

    vi.setSystemTime(new Date("2026-01-01T23:00:00.000Z"))
    expect(
      cache.get({
        provider: "aniDb",
        requestKey: "https://example.test/anime?aid=1",
      })?.body,
    ).toBe("<anime/>")

    vi.setSystemTime(new Date("2026-01-02T01:00:00.000Z"))
    expect(
      cache.get({
        provider: "aniDb",
        requestKey: "https://example.test/anime?aid=1",
      }),
    ).toBeNull()

    cache.close()
  })

  test("get never serves a network-first provider's row, however young", () => {
    const cache = openTemporaryCache({
      fileName: "network-first.sqlite",
    })

    cache.set({
      body: "<html>disc</html>",
      provider: "dvdCompare",
      requestKey: "https://example.test/disc",
    })

    expect(
      cache.get({
        provider: "dvdCompare",
        requestKey: "https://example.test/disc",
      }),
    ).toBeNull()
    expect(
      cache.getStale({
        provider: "dvdCompare",
        requestKey: "https://example.test/disc",
      })?.body,
    ).toBe("<html>disc</html>")

    cache.close()
  })

  test("keeps an imported answer's own fetch time", () => {
    const cache = openTemporaryCache({
      fileName: "imported.sqlite",
    })

    cache.set({
      body: "<anime/>",
      fetchedAt: 1_000,
      provider: "aniDb",
      requestKey: "https://example.test/anime?aid=2",
    })

    expect(
      cache.getStale({
        provider: "aniDb",
        requestKey: "https://example.test/anime?aid=2",
      })?.fetchedAt,
    ).toBe(1_000)

    cache.close()
  })

  test("getStale keeps the expired row so its etag can drive a conditional request", () => {
    const cache = openTemporaryCache({
      fileName: "stale.sqlite",
      freshWindowByProvider: { aniDb: 0 },
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

  test("a provider the table does not name gets no fresh window", () => {
    const cache = openTemporaryCache({
      fileName: "per-provider.sqlite",
      freshWindowByProvider: {
        patientProvider: millisecondsPerDay,
      },
    })

    cache.set({
      body: "patient",
      provider: "patientProvider",
      requestKey: "https://example.test/one",
    })
    cache.set({
      body: "unlisted",
      provider: "unlistedProvider",
      requestKey: "https://example.test/two",
    })

    expect(
      cache.get({
        provider: "patientProvider",
        requestKey: "https://example.test/one",
      })?.body,
    ).toBe("patient")
    expect(
      cache.get({
        provider: "unlistedProvider",
        requestKey: "https://example.test/two",
      }),
    ).toBeNull()

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
      provider: "vgmdbCddb",
      requestKey: "https://example.test/album/1",
    })
    firstHandle.close()

    const secondHandle = openTemporaryCache({
      fileName: "persisted.sqlite",
    })

    expect(
      secondHandle.getStale({
        provider: "vgmdbCddb",
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

// The owner's rule of 2026-09-29, locked: every provider fetches the latest
// first, and AniDB alone may serve a stored answer without asking — for
// one day, because AniDB bans a client that asks for one anime twice in a
// day. A second non-zero entry needs a documented rule like that, and a new
// decision record, not an edit here.
describe("PROVIDER_CACHE_POLICIES", () => {
  test("gives AniDB a one-day window and every other provider none", () => {
    expect(
      Object.entries(PROVIDER_CACHE_POLICIES)
        .filter(
          ([, policy]) =>
            policy.freshWindowMilliseconds > 0,
        )
        .map(([provider, policy]) => [
          provider,
          policy.freshWindowMilliseconds,
        ]),
    ).toEqual([["aniDb", millisecondsPerDay]])
  })

  test("names every provider a fetcher is registered under", () => {
    // The type already refuses an unnamed provider at compile time; this
    // is the list the three drifted keys (`vgmdb` for `vgmdbCddb`, no
    // `freedbCddb`, no `discogs`) were missing from.
    expect(
      Object.keys(PROVIDER_CACHE_POLICIES).sort(),
    ).toEqual([
      "acoustId",
      "aniDb",
      "animeThemes",
      "coverArtArchive",
      "criterionForum",
      "discogs",
      "dvdCompare",
      "freedbCddb",
      "itunes",
      "jikan",
      "movieDb",
      "musicBrainz",
      "myAnimeList",
      "tvdb",
      "vgmdbCddb",
    ])
  })
})
