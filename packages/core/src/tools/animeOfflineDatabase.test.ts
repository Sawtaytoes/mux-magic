import { join } from "node:path"
import { vol } from "memfs"
import { afterEach, expect, test, vi } from "vitest"
import { captureProviderCacheFallbacks } from "../provider-cache/providerCacheFallbacks.js"
import { loadAnimeIndex } from "./animeOfflineDatabase.js"
import { getAnidbCacheDir } from "./getAnidbCacheDir.js"

afterEach(() => vi.unstubAllGlobals())

test("each concurrent search reports the shared dataset fallback", async () => {
  vol.fromJSON({
    [join(
      getAnidbCacheDir(),
      "manami",
      "anime-offline-database.json",
    )]: JSON.stringify({
      data: [
        {
          title: "Example Series",
          sources: ["https://anidb.net/anime/42"],
        },
      ],
    }),
  })
  const fetchSpy = vi
    .fn()
    .mockRejectedValue(new Error("network down"))
  vi.stubGlobal("fetch", fetchSpy)
  const results = await Promise.all([
    captureProviderCacheFallbacks(loadAnimeIndex),
    captureProviderCacheFallbacks(loadAnimeIndex),
  ])
  expect(fetchSpy).toHaveBeenCalledOnce()
  expect(results[0]?.value).toEqual([
    expect.objectContaining({
      aid: 42,
      name: "Example Series",
    }),
  ])
  expect(results[1]?.value).toEqual(results[0]?.value)
  expect(results[0]?.providerCacheFallbacks).toHaveLength(1)
  expect(results[1]?.providerCacheFallbacks).toEqual(
    results[0]?.providerCacheFallbacks,
  )
})
