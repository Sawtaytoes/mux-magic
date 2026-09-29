import { describe, expect, test, vi } from "vitest"

import {
  createCachedComputation,
  withTimeout,
} from "./cachedComputation.js"
import { openProviderCache } from "./providerCache.js"
import {
  type ProviderCacheFallback,
  registerProviderCacheFallbackListener,
} from "./providerCacheFallbacks.js"

// An in-memory database, so the real table runs and no file is touched.
// The default fresh windows apply: `dvdCompare` is network-first.
const openMemoryCache = () =>
  openProviderCache({ databasePath: ":memory:" })

const collectFallbacks = () =>
  ((fallbacks: ProviderCacheFallback[]) => ({
    fallbacks,
    unregister: registerProviderCacheFallbackListener(
      (fallback) => {
        fallbacks.push(fallback)
      },
    ),
  }))([])

describe(createCachedComputation.name, () => {
  test("runs the producer on every call, even with a stored value", async () => {
    const produceValue = vi
      .fn()
      .mockResolvedValueOnce({ extras: "Audio commentary" })
      .mockResolvedValueOnce({
        extras: "Audio commentary\nTrailer",
      })
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(),
      provider: "dvdCompare",
    })

    await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#2",
    })
    const second = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=1#2",
    })

    expect(produceValue).toHaveBeenCalledTimes(2)
    expect(second).toEqual({
      extras: "Audio commentary\nTrailer",
    })
  })

  test("keys on the request key, so a second release of the same film is its own entry", async () => {
    const cache = openMemoryCache()
    const cachedComputation = createCachedComputation({
      cache,
      provider: "dvdCompare",
    })

    await cachedComputation({
      produceValue: async () => ({ extras: "Release one" }),
      requestKey: "scrape|film.php?fid=1#1",
    })
    await cachedComputation({
      produceValue: async () => ({ extras: "Release two" }),
      requestKey: "scrape|film.php?fid=1#2",
    })

    expect(
      cache.getStale({
        provider: "dvdCompare",
        requestKey: "scrape|film.php?fid=1#1",
      })?.body,
    ).toBe('{"extras":"Release one"}')
  })

  test("serves the stored value and reports it when the producer fails", async () => {
    const { fallbacks, unregister } = collectFallbacks()
    const produceValue = vi
      .fn()
      .mockResolvedValueOnce({ extras: "Deleted scenes" })
      .mockRejectedValue(new TypeError("fetch failed"))
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(),
      provider: "dvdCompare",
    })

    const live = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=2#1",
    })
    const fallback = await cachedComputation({
      produceValue,
      requestKey: "scrape|film.php?fid=2#1",
    })
    unregister()

    expect(fallback).toEqual(live)
    expect(produceValue).toHaveBeenCalledTimes(2)
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({
      cause: "fetch failed",
      isProviderSkipped: false,
      provider: "dvdCompare",
      request: "scrape|film.php?fid=2#1",
    })
  })

  test("re-raises the failure when nothing was ever cached", async () => {
    const cachedComputation = createCachedComputation({
      cache: openMemoryCache(),
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
    const cache = openMemoryCache()
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

  test("asks the last resort only when nothing is stored, and stores its answer", async () => {
    const cache = openMemoryCache()
    const cachedComputation = createCachedComputation({
      cache,
      provider: "dvdCompare",
    })
    const produceLastResortValue = vi.fn(async () => ({
      extras: "From the archive",
    }))

    const value = await cachedComputation({
      produceLastResortValue,
      produceValue: () =>
        Promise.reject(new TypeError("fetch failed")),
      requestKey: "scrape|film.php?fid=5#1",
    })

    expect(value).toEqual({ extras: "From the archive" })
    expect(
      cache.getStale({
        provider: "dvdCompare",
        requestKey: "scrape|film.php?fid=5#1",
      })?.body,
    ).toBe('{"extras":"From the archive"}')
  })

  test("prefers the stored value over the last resort", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: '{"extras":"Stored"}',
      provider: "dvdCompare",
      requestKey: "scrape|film.php?fid=6#1",
    })
    const cachedComputation = createCachedComputation({
      cache,
      provider: "dvdCompare",
    })
    const produceLastResortValue = vi.fn(async () => ({
      extras: "From the archive",
    }))

    const value = await cachedComputation({
      produceLastResortValue,
      produceValue: () =>
        Promise.reject(new TypeError("fetch failed")),
      requestKey: "scrape|film.php?fid=6#1",
    })

    expect(value).toEqual({ extras: "Stored" })
    expect(produceLastResortValue).not.toHaveBeenCalled()
  })

  test("a production that outlasts its timeout falls back to the stored value", async () => {
    const cache = openMemoryCache()
    cache.set({
      body: '{"html":"<p>post</p>"}',
      provider: "criterionForum",
      requestKey: "post|1",
    })
    const cachedComputation = createCachedComputation({
      cache,
      provider: "criterionForum",
      timeoutMilliseconds: 20,
    })

    const value = await cachedComputation({
      produceValue: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ html: "too late" })
          }, 1_000)
        }),
      requestKey: "post|1",
    })

    expect(value).toEqual({ html: "<p>post</p>" })
  })
})

describe(withTimeout.name, () => {
  test("rejects with a TimeoutError naming the request", async () => {
    await expect(
      withTimeout({
        describeRequest: "criterionForum post|1",
        produceValue: () => new Promise(() => {}),
        timeoutMilliseconds: 10,
      }),
    ).rejects.toMatchObject({
      message:
        "criterionForum post|1 timed out after 10 ms",
      name: "TimeoutError",
    })
  })
})
