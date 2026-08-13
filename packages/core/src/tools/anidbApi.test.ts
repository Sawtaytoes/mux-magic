import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { getAnimeXml } from "./anidbApi.js"

const CLIENT = {
  client: "muxmagic",
  clientver: "1",
}

const buildXml = (aid: number) =>
  `<anime id="${aid}"><episodes></episodes></anime>`

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
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => buildXml(17005),
    }))
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

  test("a failed lookup does not poison the next attempt", async () => {
    // The in-flight entry must clear on rejection too, otherwise every
    // later call for that aid replays the original failure forever.
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => buildXml(1),
      })
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
})
