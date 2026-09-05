import { describe, expect, test, vi } from "vitest"

import { createCachedComputation } from "./cachedComputation.js"
import { openProviderCache } from "./providerCache.js"

// An in-memory database, so the real freshness rule runs and no file is
// touched. A zero time to live makes every stored row expired on the next
// read, which is how the outage case is reproduced without fake timers.
const openMemoryCache = (timeToLiveMilliseconds: number) =>
  openProviderCache({
    databasePath: ":memory:",
    timeToLiveByProvider: {
      dvdCompare: timeToLiveMilliseconds,
    },
  })

const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000

describe(createCachedComputation.name, () => {
  test("runs the producer once and serves the second call from the cache", async () => {
    const produceValue = vi.fn(async () => ({
      extras: "Audio commentary",
      filmTitle: null,
    }))
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(millisecondsPerWeek),
      provider: "dvdCompare",
    })

    const first = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#2",
    })
    const second = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#2",
    })

    expect(second).toEqual(first)
    expect(produceValue).toHaveBeenCalledOnce()
  })

  test("keys on the request key, so a second release of the same film is its own entry", async () => {
    const produceValue = vi.fn(async () => ({
      extras: "Audio commentary",
    }))
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(millisecondsPerWeek),
      provider: "dvdCompare",
    })

    await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#1",
    })
    await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#2",
    })

    expect(produceValue).toHaveBeenCalledTimes(2)
  })

  test("serves the expired value when the producer fails", async () => {
    const produceValue = vi
      .fn()
      .mockResolvedValueOnce({ extras: "Deleted scenes" })
      .mockRejectedValue(new TypeError("fetch failed"))
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(0),
      provider: "dvdCompare",
    })

    const fresh = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=2#1",
    })
    const stale = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=2#1",
    })

    expect(stale).toEqual(fresh)
    expect(produceValue).toHaveBeenCalledTimes(2)
  })

  test("re-raises the failure when nothing was ever cached", async () => {
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(millisecondsPerWeek),
      provider: "dvdCompare",
    })

    await expect(
      cachedComputation({
        produceValue: () =>
          Promise.reject(new TypeError("fetch failed")),
        requestKey: "scrape|film.php?fid=3#1",
      }),
    ).rejects.toThrow("fetch failed")
  })

  test("stores nothing when the producer fails", async () => {
    const cache = openMemoryCache(millisecondsPerWeek)
    const cachedComputation = createCachedComputation({
      cache,
      provider: "dvdCompare",
    })

    await expect(
      cachedComputation({
        produceValue: () =>
          Promise.reject(new Error("No extras")),
        requestKey: "scrape|film.php?fid=4#1",
      }),
    ).rejects.toThrow("No extras")

    expect(
      cache.getStale({
        provider: "dvdCompare",
        requestKey: "scrape|film.php?fid=4#1",
      }),
    ).toBeNull()
  })
})
