import { describe, expect, test } from "vitest"

import type { AnidbEpisode } from "../types/anidb.js"
import {
  compileFilenameRegex,
  extractEpisodeNumberFromFilename,
  pairEpisodeToFileIndex,
} from "./nameAnimeEpisodesAniDB.js"

const makeEpisode = (epno: string): AnidbEpisode => ({
  epno,
  titles: [{ lang: "en", value: `Episode ${epno}` }],
  type: 1,
})

// A full season of "regular" episodes, epno "1".."12".
const season = Array.from({ length: 12 }, (_item, index) =>
  makeEpisode(String(index + 1)),
)

describe(compileFilenameRegex.name, () => {
  test("returns null when no pattern is provided", () => {
    expect(compileFilenameRegex(undefined)).toBeNull()
    expect(compileFilenameRegex("")).toBeNull()
  })

  test("compiles a valid pattern case-insensitively", () => {
    const compiled = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    expect(compiled).toBeInstanceOf(RegExp)
    expect(compiled?.flags).toContain("i")
    expect("jigokuraku - s02e05 [vodes].mkv").toMatch(
      compiled as RegExp,
    )
  })

  test("throws a descriptive error on an invalid pattern", () => {
    expect(() => compileFilenameRegex("S(\\d+E")).toThrow(
      /Invalid filenameRegex/,
    )
  })
})

describe(extractEpisodeNumberFromFilename.name, () => {
  const regex = compileFilenameRegex(
    "S\\d+E(?<episodeNumber>\\d+)",
  ) as RegExp

  test("pulls the episodeNumber named group as a number", () => {
    expect(
      extractEpisodeNumberFromFilename(
        "Jigokuraku - S02E05 [Vodes].mkv",
        regex,
      ),
    ).toBe(5)
  })

  test("strips leading zeros", () => {
    expect(
      extractEpisodeNumberFromFilename(
        "Show - S01E09.mkv",
        regex,
      ),
    ).toBe(9)
  })

  test("returns null when the pattern does not match", () => {
    expect(
      extractEpisodeNumberFromFilename(
        "Show - OVA.mkv",
        regex,
      ),
    ).toBeNull()
  })

  test("returns null when there is no episodeNumber group", () => {
    const noGroup = compileFilenameRegex(
      "S\\d+E\\d+",
    ) as RegExp
    expect(
      extractEpisodeNumberFromFilename(
        "Show - S02E05.mkv",
        noGroup,
      ),
    ).toBeNull()
  })
})

describe(pairEpisodeToFileIndex.name, () => {
  test("defaults to natural-sort index pairing from episode 1", () => {
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex: null,
      episodes: season,
      filename: "Show - 01.mkv",
      index: 0,
      startEpisodeNumber: 1,
    })
    expect(result.episode?.epno).toBe("1")
    expect(result.sequentialIndex).toBe(1)
  })

  test("startEpisodeNumber offsets index pairing for a partial set", () => {
    // A folder holding only E05..E12 (8 files): file index 0 should
    // pair with episode 5, index 7 with episode 12.
    const first = pairEpisodeToFileIndex({
      compiledFilenameRegex: null,
      episodes: season,
      filename: "Show - 05.mkv",
      index: 0,
      startEpisodeNumber: 5,
    })
    expect(first.episode?.epno).toBe("5")
    expect(first.sequentialIndex).toBe(5)

    const last = pairEpisodeToFileIndex({
      compiledFilenameRegex: null,
      episodes: season,
      filename: "Show - 12.mkv",
      index: 7,
      startEpisodeNumber: 5,
    })
    expect(last.episode?.epno).toBe("12")
    expect(last.sequentialIndex).toBe(12)
  })

  test("filenameRegex pairs by the extracted episode number regardless of index", () => {
    const compiledFilenameRegex = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    // File index 0, but the filename says E07 → episode 7, not 1.
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex,
      episodes: season,
      filename: "Jigokuraku - S02E07 [Vodes].mkv",
      index: 0,
      startEpisodeNumber: 1,
    })
    expect(result.episode?.epno).toBe("7")
    expect(result.sequentialIndex).toBe(7)
  })

  test("filenameRegex handles an out-of-order file list", () => {
    const compiledFilenameRegex = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    // Second file in the list is E03 — index pairing would mis-pair it
    // with episode 2, but the regex pins it to episode 3.
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex,
      episodes: season,
      filename: "Show - S01E03.mkv",
      index: 1,
      startEpisodeNumber: 1,
    })
    expect(result.episode?.epno).toBe("3")
  })

  test("falls back to index+offset when the regex does not match a file", () => {
    const compiledFilenameRegex = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex,
      episodes: season,
      filename: "Show - Recap.mkv",
      index: 0,
      startEpisodeNumber: 5,
    })
    expect(result.episode?.epno).toBe("5")
    expect(result.sequentialIndex).toBe(5)
  })

  test("returns no episode when the extracted number is absent from AniDB", () => {
    const compiledFilenameRegex = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex,
      episodes: season,
      filename: "Show - S01E99.mkv",
      index: 0,
      startEpisodeNumber: 1,
    })
    expect(result.episode).toBeUndefined()
  })

  test("matches AniDB epno on its numeric part (zero-padded epno)", () => {
    const compiledFilenameRegex = compileFilenameRegex(
      "S\\d+E(?<episodeNumber>\\d+)",
    )
    const paddedSeason = [
      makeEpisode("01"),
      makeEpisode("02"),
      makeEpisode("03"),
    ]
    const result = pairEpisodeToFileIndex({
      compiledFilenameRegex,
      episodes: paddedSeason,
      filename: "Show - S01E02.mkv",
      index: 0,
      startEpisodeNumber: 1,
    })
    expect(result.episode?.epno).toBe("02")
  })
})
