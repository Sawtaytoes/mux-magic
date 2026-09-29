import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { createCachedFetch } from "../provider-cache/cachedFetch.js"
import {
  openProviderCache,
  type ProviderCache,
} from "../provider-cache/providerCache.js"
import type { JobEvent } from "./jobStore.js"
import {
  createJob,
  createSubject,
  getJob,
  resetStore,
} from "./jobStore.js"
import { withJobContext } from "./logCapture.js"
import {
  installProviderCacheFallbackBridge,
  uninstallProviderCacheFallbackBridge,
} from "./providerCacheFallbackBridge.js"

const FILM_URL = "https://example.test/film?fid=1"
const SEARCH_URL = "https://example.test/search?q=1"

const openCacheWithRows = () =>
  ((cache: ProviderCache) => {
    ;[FILM_URL, SEARCH_URL].forEach((requestKey) => {
      cache.set({
        body: `stored ${requestKey}`,
        provider: "dvdCompare",
        requestKey,
      })
    })
    return cache
  })(openProviderCache({ databasePath: ":memory:" }))

const buildUnreachableFetch = ({
  cache,
}: {
  cache: ProviderCache
}) =>
  createCachedFetch({
    cache,
    minimumRequestIntervalMilliseconds: 0,
    provider: "dvdCompare",
    userAgent: "mux-magic-test",
  })

describe("providerCacheFallbackBridge", () => {
  const originalFetch = globalThis.fetch
  const fetchSpy = vi.fn(() =>
    Promise.reject(new TypeError("fetch failed")),
  )

  beforeEach(() => {
    fetchSpy.mockClear()
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch
    installProviderCacheFallbackBridge()
  })

  afterEach(() => {
    uninstallProviderCacheFallbackBridge()
    globalThis.fetch = originalFetch
    resetStore()
  })

  test("a fallback during a step lands on the step, on its umbrella, and on both event streams", async () => {
    const umbrella = createJob({ commandName: "sequence" })
    const step = createJob({
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
      parentJobId: umbrella.id,
    })
    const umbrellaEvents: (string | JobEvent)[] = []
    const stepEvents: (string | JobEvent)[] = []
    createSubject(umbrella.id).subscribe((event) => {
      umbrellaEvents.push(event)
    })
    createSubject(step.id).subscribe((event) => {
      stepEvents.push(event)
    })
    const cachedFetch = buildUnreachableFetch({
      cache: openCacheWithRows(),
    })

    await withJobContext(step.id, () =>
      cachedFetch(FILM_URL),
    )

    const expectedFallback = expect.objectContaining({
      isProviderSkipped: false,
      provider: "dvdCompare",
      request: FILM_URL,
    })
    expect(getJob(step.id)?.providerCacheFallbacks).toEqual(
      [expectedFallback],
    )
    expect(
      getJob(umbrella.id)?.providerCacheFallbacks,
    ).toEqual([expectedFallback])
    expect(umbrellaEvents).toEqual([
      {
        fallback: expectedFallback,
        index: 0,
        type: "provider-cache-fallback",
      },
    ])
    expect(stepEvents).toHaveLength(1)
  })

  test("a sequence's steps share one circuit: the second step does not ask again", async () => {
    const umbrella = createJob({ commandName: "sequence" })
    const firstStep = createJob({
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
      parentJobId: umbrella.id,
    })
    const secondStep = createJob({
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
      parentJobId: umbrella.id,
    })
    const cachedFetch = buildUnreachableFetch({
      cache: openCacheWithRows(),
    })

    await withJobContext(firstStep.id, () =>
      cachedFetch(FILM_URL),
    )
    await withJobContext(secondStep.id, () =>
      cachedFetch(SEARCH_URL),
    )

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(
      getJob(umbrella.id)?.providerCacheFallbacks.map(
        ({ isProviderSkipped }) => isProviderSkipped,
      ),
    ).toEqual([false, true])
  })

  test("a different job still asks the provider", async () => {
    const firstJob = createJob({ commandName: "one" })
    const secondJob = createJob({ commandName: "two" })
    const cachedFetch = buildUnreachableFetch({
      cache: openCacheWithRows(),
    })

    await withJobContext(firstJob.id, () =>
      cachedFetch(FILM_URL),
    )
    await withJobContext(secondJob.id, () =>
      cachedFetch(FILM_URL),
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test("a read outside any job has no circuit and lands on no job", async () => {
    const bystander = createJob({ commandName: "idle" })
    const cachedFetch = buildUnreachableFetch({
      cache: openCacheWithRows(),
    })

    // A Builder lookup: a retry must reach the provider again, not fail
    // at once because an earlier lookup failed.
    await cachedFetch(FILM_URL)
    await cachedFetch(FILM_URL)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(
      getJob(bystander.id)?.providerCacheFallbacks,
    ).toEqual([])
  })
})
