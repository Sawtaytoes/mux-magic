import { readFileSync } from "node:fs"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, expect, test, vi } from "vitest"
import { fetchThemeMusic } from "./fetchThemeMusic.js"

vi.mock("../tools/animeThemesApi.js", () => ({
  getAnimeThemeWithMainShowFallback: vi.fn(),
}))

import { getAnimeThemeWithMainShowFallback } from "../tools/animeThemesApi.js"

const getMockedAnimeTheme = vi.mocked(
  getAnimeThemeWithMainShowFallback,
)

beforeEach(() => {
  vol.reset()
  getMockedAnimeTheme.mockReset()
})

test("writes a review manifest without writing theme files", async () => {
  vol.fromJSON({
    "/Anime/Has Theme [anidb-14111]/theme.mp3": "old theme",
    "/Anime/No Tag/episode.mkv": "episode",
  })
  getMockedAnimeTheme.mockResolvedValue({
    artist: "Masayuki Suzuki",
    audioUrl: "https://a.animethemes.moe/example.ogg",
    fallbackAnidbId: null,
    slug: "kaguya",
    song: "Love Dramatic",
    source: "own",
  })

  const records = await firstValueFrom(
    fetchThemeMusic({ sourcePath: "/Anime" }).pipe(
      toArray(),
    ),
  )

  expect(records).toHaveLength(2)
  expect(records[0]).toMatchObject({
    anidbId: 14111,
    hasExistingTheme: true,
    result: "planned",
    song: "Love Dramatic",
  })
  expect(records[1]).toMatchObject({
    anidbId: null,
    result: "missing-anidb-id",
  })
  expect(
    readFileSync(
      "/Anime/Has Theme [anidb-14111]/theme.mp3",
      "utf8",
    ),
  ).toBe("old theme")
  expect(
    JSON.parse(
      readFileSync(
        "/Anime/theme-music-manifest.json",
        "utf8",
      ),
    ),
  ).toHaveLength(2)
})

test("does not resolve folders without an AniDB tag", async () => {
  vol.fromJSON({ "/Anime/No Tag/episode.mkv": "episode" })

  const records = await firstValueFrom(
    fetchThemeMusic({ sourcePath: "/Anime" }).pipe(
      toArray(),
    ),
  )

  expect(records).toEqual([
    expect.objectContaining({ result: "missing-anidb-id" }),
  ])
  expect(getMockedAnimeTheme).not.toHaveBeenCalled()
})
