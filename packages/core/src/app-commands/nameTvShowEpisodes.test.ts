import { describe, expect, test } from "vitest"

import {
  compileFilenameRegex,
  pairEpisodeToFile,
  parseSeasonEpisodeFromFilename,
  type TvdbEpisodeSummary,
} from "./nameTvShowEpisodes.js"

const makeEpisode = ({
  episodeNumber,
  seasonNumber = 1,
}: {
  episodeNumber: number
  seasonNumber?: number
}): TvdbEpisodeSummary => ({
  airedYear: "1960",
  episodeName: `Episode ${episodeNumber}`,
  episodeNumber: String(episodeNumber),
  seasonNumber: String(seasonNumber),
  seriesName: "The Flintstones",
})

// A full season 1, episode numbers 1..28.
const seasonOne = Array.from(
  { length: 28 },
  (_item, index) =>
    makeEpisode({ episodeNumber: index + 1 }),
)

describe(parseSeasonEpisodeFromFilename.name, () => {
  test("reads the Plex/scene s01e06 form", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "The Flintstones (1960) - S01E06 - The Monster from the Tar Pits",
        null,
      ),
    ).toEqual({ episodeNumber: 6, seasonNumber: 1 })
  })

  test("reads a specials filename as season 0", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "The Flintstones - S00E01 - The Flagstones (Pilot)",
        null,
      ),
    ).toEqual({ episodeNumber: 1, seasonNumber: 0 })
  })

  test("reads the older 1x06 form", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "Show 1x06 title",
        null,
      ),
    ).toEqual({ episodeNumber: 6, seasonNumber: 1 })
  })

  test("does not read a resolution tag as a season and episode", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "Show - title (1920x1080 x265)",
        null,
      ),
    ).toBeNull()
  })

  test("prefers the s01e06 form over a resolution tag in the same name", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "Show - S02E11 - title [1920x1080]",
        null,
      ),
    ).toEqual({ episodeNumber: 11, seasonNumber: 2 })
  })

  test("returns null when the name carries no numbering", () => {
    expect(
      parseSeasonEpisodeFromFilename("bonus feature", null),
    ).toBeNull()
  })

  test("uses the caller's regex when one is supplied", () => {
    expect(
      parseSeasonEpisodeFromFilename(
        "Show - Episode 07",
        compileFilenameRegex(
          "Episode (?<episodeNumber>\\d+)",
        ),
      ),
    ).toEqual({ episodeNumber: 7, seasonNumber: null })
  })
})

describe(compileFilenameRegex.name, () => {
  test("returns null when no pattern is provided", () => {
    expect(compileFilenameRegex(undefined)).toBeNull()
    expect(compileFilenameRegex("")).toBeNull()
  })

  test("throws a descriptive error on an invalid pattern", () => {
    expect(() => compileFilenameRegex("([")).toThrow(
      /Invalid filenameRegex/,
    )
  })
})

describe(pairEpisodeToFile.name, () => {
  test("pairs by the filename number, not by sort position", () => {
    // Downloads listed this file fourth; TVDB has it at 17.
    const { episode } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: seasonOne,
      filename:
        "The Flintstones - S01E17 - The Big Bank Robbery.mkv",
      index: 3,
      seasonNumber: 1,
      startEpisodeNumber: 1,
    })

    expect(episode?.episodeNumber).toBe("17")
  })

  test("refuses a specials file during a season 1 run", () => {
    // The defect this function exists for: 36 s00 specials sort ahead
    // of season 1, and index pairing renamed them into season 1.
    const { episode, skipReason } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: seasonOne,
      filename:
        "The Flintstones - S00E01 - The Flagstones (Pilot).mkv",
      index: 0,
      seasonNumber: 1,
      startEpisodeNumber: 1,
    })

    expect(episode).toBeUndefined()
    expect(skipReason).toContain("WRONG SEASON")
  })

  test("refuses a file whose episode number is not in the TVDB season", () => {
    const { episode, skipReason } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: seasonOne,
      filename: "Show - S01E99 - extra.mkv",
      index: 0,
      seasonNumber: 1,
      startEpisodeNumber: 1,
    })

    expect(episode).toBeUndefined()
    expect(skipReason).toContain("NO TVDB EPISODE 99")
  })

  test("falls back to sort order for a file with no numbering", () => {
    const { episode } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: seasonOne,
      filename: "third file.mkv",
      index: 2,
      seasonNumber: 1,
      startEpisodeNumber: 1,
    })

    expect(episode?.episodeNumber).toBe("3")
  })

  test("offsets the sort-order fallback by startEpisodeNumber", () => {
    const { episode } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: seasonOne,
      filename: "first file.mkv",
      index: 0,
      seasonNumber: 1,
      startEpisodeNumber: 5,
    })

    expect(episode?.episodeNumber).toBe("5")
  })

  test("pairs a season 0 run against the specials it looked up", () => {
    const specials = Array.from(
      { length: 36 },
      (_item, index) =>
        makeEpisode({
          episodeNumber: index + 1,
          seasonNumber: 0,
        }),
    )

    const { episode } = pairEpisodeToFile({
      compiledFilenameRegex: null,
      episodes: specials,
      filename:
        "The Flintstones - S00E28 - Wacky Inventions.mkv",
      index: 0,
      seasonNumber: 0,
      startEpisodeNumber: 1,
    })

    expect(episode?.episodeNumber).toBe("28")
  })

  test("pairs by a caller regex with no season group", () => {
    const { episode } = pairEpisodeToFile({
      compiledFilenameRegex: compileFilenameRegex(
        "Ep(?<episodeNumber>\\d+)",
      ),
      episodes: seasonOne,
      filename: "Show Ep12.mkv",
      index: 0,
      seasonNumber: 1,
      startEpisodeNumber: 1,
    })

    expect(episode?.episodeNumber).toBe("12")
  })
})
