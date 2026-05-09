import { describe, expect, test } from "vitest"

import type { AnidbEpisode } from "../types/anidb.js"
import { detectMovieFormatVariants } from "./detectMovieFormatVariants.js"

const buildEpisode = (
  type: AnidbEpisode["type"],
  epno: string,
  englishTitle: string,
  length?: number,
): AnidbEpisode => ({
  airdate: undefined,
  epno,
  length,
  titles: [{ lang: "en", value: englishTitle }],
  type,
})

describe("detectMovieFormatVariants", () => {
  test("returns null when no episode title contains a Part marker", () => {
    const episodes = [
      buildEpisode(1, "1", "Episode 1"),
      buildEpisode(1, "2", "Episode 2"),
      buildEpisode(1, "3", "Episode 3"),
    ]
    expect(detectMovieFormatVariants(episodes)).toBeNull()
  })

  test("returns null when only a single Part entry is present", () => {
    // A single "Part 1" without a sibling "Part 2" is more likely a
    // stylistic title choice than a part-of-N decomposition. Don't
    // flag it.
    const episodes = [
      buildEpisode(1, "1", "Movie"),
      buildEpisode(1, "2", "The First Part"),
    ]
    expect(detectMovieFormatVariants(episodes)).toBeNull()
  })

  test("returns null when only Part entries exist (no Complete)", () => {
    const episodes = [
      buildEpisode(1, "1", "Part 1 of 2"),
      buildEpisode(1, "2", "Part 2 of 2"),
    ]
    expect(detectMovieFormatVariants(episodes)).toBeNull()
  })

  test("splits Complete vs Parts when both forms are present", () => {
    const completeEpisode = buildEpisode(1, "1", "Complete Movie", 90)
    const part1 = buildEpisode(1, "2", "Part 1 of 2", 45)
    const part2 = buildEpisode(1, "3", "Part 2 of 2", 45)
    const variants = detectMovieFormatVariants([completeEpisode, part1, part2])
    expect(variants).not.toBeNull()
    expect(variants?.complete).toEqual([completeEpisode])
    expect(variants?.parts).toEqual([part1, part2])
  })

  test("matches case-insensitively (PART, Part, part)", () => {
    const completeEpisode = buildEpisode(1, "1", "Movie")
    const part1 = buildEpisode(1, "2", "PART 1")
    const part2 = buildEpisode(1, "3", "part 2")
    const variants = detectMovieFormatVariants([completeEpisode, part1, part2])
    expect(variants?.complete).toEqual([completeEpisode])
    expect(variants?.parts).toEqual([part1, part2])
  })

  test("scans every title on each episode (not just the first)", () => {
    // AniDB ships titles in multiple languages; the part marker may
    // only appear in one of them. Detection should still trigger.
    const completeEpisode = buildEpisode(1, "1", "Movie")
    const partEpisodeOne: AnidbEpisode = {
      airdate: undefined,
      epno: "2",
      length: undefined,
      titles: [
        { lang: "x-jat", value: "Eiga Daiichi-bu" },
        { lang: "en", value: "Part 1 of 2" },
      ],
      type: 1,
    }
    const partEpisodeTwo = buildEpisode(1, "3", "Part 2 of 2")
    const variants = detectMovieFormatVariants([completeEpisode, partEpisodeOne, partEpisodeTwo])
    expect(variants?.parts).toContain(partEpisodeOne)
  })
})
