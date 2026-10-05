import { join } from "node:path"
import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { captureProviderCacheFallbacks } from "../provider-cache/providerCacheFallbacks.js"

import {
  ANIDB_PROVIDER,
  buildAnidbAnimeUrl,
  getAnimeXml,
} from "./anidbApi.js"
import { getAnidbCacheDir } from "./getAnidbCacheDir.js"
import { getSharedProviderCache } from "./sharedProviderCache.js"

const CLIENT = {
  client: "muxmagic",
  clientver: "1",
}

const millisecondsPerHour = 60 * 60 * 1000

const buildXml = (aid: number) =>
  `<anime id="${aid}"><episodes></episodes></anime>`

const buildXmlResponse = (xml: string) =>
  new Response(xml, { status: 200 })

const storeAnswer = ({
  aid,
  ageMilliseconds,
  xml,
}: {
  aid: number
  ageMilliseconds: number
  xml: string
}) => {
  getSharedProviderCache().set({
    body: xml,
    fetchedAt: Date.now() - ageMilliseconds,
    provider: ANIDB_PROVIDER,
    requestKey: buildAnidbAnimeUrl({ aid, ...CLIENT }),
  })
}

const readStoredAnswer = (aid: number) =>
  getSharedProviderCache().getStale({
    provider: ANIDB_PROVIDER,
    requestKey: buildAnidbAnimeUrl({ aid, ...CLIENT }),
  })

describe(getAnimeXml.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("collapses concurrent lookups of the same aid into ONE request", async () => {
    // Three nameAnimeEpisodesAniDB steps in a parallel group all rename
    // folders of the same series. Without de-duplication they each fetch
    // the same XML — three requests against AniDB's 1-req/2s cap for data
    // that is byte-identical.
    const fetchSpy = vi.fn(async () =>
      buildXmlResponse(buildXml(17005)),
    )
    vi.stubGlobal("fetch", fetchSpy)

    const results = await Promise.all([
      getAnimeXml(17005, CLIENT),
      getAnimeXml(17005, CLIENT),
      getAnimeXml(17005, CLIENT),
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      buildXml(17005),
      buildXml(17005),
      buildXml(17005),
    ])
  })

  test("both concurrent lookup responses report a shared cached answer", async () => {
    storeAnswer({
      aid: 42,
      ageMilliseconds: 48 * millisecondsPerHour,
      xml: buildXml(42),
    })
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new Error("network down"))
    vi.stubGlobal("fetch", fetchSpy)
    const results = await Promise.all([
      captureProviderCacheFallbacks(() =>
        getAnimeXml(42, CLIENT),
      ),
      captureProviderCacheFallbacks(() =>
        getAnimeXml(42, CLIENT),
      ),
    ])
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(results[0]?.value).toBe(buildXml(42))
    expect(results[1]?.value).toBe(buildXml(42))
    expect(results[0]?.providerCacheFallbacks).toHaveLength(
      1,
    )
    expect(results[1]?.providerCacheFallbacks).toEqual(
      results[0]?.providerCacheFallbacks,
    )
  })

  test("a failed lookup does not poison the next attempt", async () => {
    // The in-flight entry must clear on rejection too, otherwise every
    // later call for that aid replays the original failure forever.
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(buildXmlResponse(buildXml(1)))
    vi.stubGlobal("fetch", fetchSpy)

    await expect(getAnimeXml(1, CLIENT)).rejects.toThrow(
      "network down",
    )
    await expect(getAnimeXml(1, CLIENT)).resolves.toBe(
      buildXml(1),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    // Real timers: the second attempt waits out the 2.5s AniDB throttle
    // slot, so this test needs headroom over the default timeout.
  }, 20_000)

  // AniDB bans a client that asks for the same anime twice in a day. That
  // is the one reason any provider keeps a no-request window.
  test("an answer younger than a day is served with no request", async () => {
    storeAnswer({
      aid: 2,
      ageMilliseconds: 23 * millisecondsPerHour,
      xml: buildXml(2),
    })
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    expect(await getAnimeXml(2, CLIENT)).toBe(buildXml(2))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("an answer older than a day is asked for again, and the new answer is stored", async () => {
    storeAnswer({
      aid: 3,
      ageMilliseconds: 25 * millisecondsPerHour,
      xml: '<anime id="3">old</anime>',
    })
    const fetchSpy = vi.fn(async () =>
      buildXmlResponse(buildXml(3)),
    )
    vi.stubGlobal("fetch", fetchSpy)

    expect(await getAnimeXml(3, CLIENT)).toBe(buildXml(3))
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(readStoredAnswer(3)?.body).toBe(buildXml(3))
  })

  test("an <error> answer is a failure: it is not stored, and the older answer stands in", async () => {
    storeAnswer({
      aid: 4,
      ageMilliseconds: 2 * 24 * millisecondsPerHour,
      xml: buildXml(4),
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        buildXmlResponse("<error>Banned</error>"),
      ),
    )

    expect(await getAnimeXml(4, CLIENT)).toBe(buildXml(4))
    expect(readStoredAnswer(4)?.body).toBe(buildXml(4))
  })

  test("an <error> answer with nothing stored rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        buildXmlResponse("<error>No such anime</error>"),
      ),
    )

    await expect(getAnimeXml(5, CLIENT)).rejects.toThrow(
      "AniDB error",
    )
    expect(readStoredAnswer(5)).toBeNull()
  })

  test("imports a pre-upgrade XML file with its file time, so a recent one still makes no request", async () => {
    const legacyPath = join(
      getAnidbCacheDir(),
      "anime",
      "6.xml",
    )
    vol.fromJSON({ [legacyPath]: buildXml(6) })
    const fileTime = new Date(
      Date.now() - 2 * millisecondsPerHour,
    )
    vol.utimesSync(legacyPath, fileTime, fileTime)
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    expect(await getAnimeXml(6, CLIENT)).toBe(buildXml(6))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(readStoredAnswer(6)?.fetchedAt).toBe(
      fileTime.getTime(),
    )
  })

  test("an old pre-upgrade XML file is the fallback when AniDB cannot answer", async () => {
    const legacyPath = join(
      getAnidbCacheDir(),
      "anime",
      "7.xml",
    )
    vol.fromJSON({ [legacyPath]: buildXml(7) })
    const fileTime = new Date(
      Date.now() - 30 * 24 * millisecondsPerHour,
    )
    vol.utimesSync(legacyPath, fileTime, fileTime)
    const fetchSpy = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    )
    vi.stubGlobal("fetch", fetchSpy)

    expect(await getAnimeXml(7, CLIENT)).toBe(buildXml(7))
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
