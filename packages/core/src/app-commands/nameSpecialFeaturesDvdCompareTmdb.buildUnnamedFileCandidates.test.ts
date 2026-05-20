import { describe, expect, test } from "vitest"
import { buildUnnamedFileCandidates } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"
import { ORDER_BONUS } from "./nameSpecialFeaturesDvdCompareTmdb.rankCandidates.js"

describe(buildUnnamedFileCandidates.name, () => {
  test("returns empty when there are no unnamed files", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [
          { name: "Image Gallery", timecode: undefined },
        ],
        unrenamedFiles: [],
      }),
    ).toEqual([])
  })

  test("emits empty-rankedCandidates entries when there are unrenamed files but no possible-name suggestions", () => {
    // Leftover files still need a UI surface even when DVDCompare has
    // no untimed extras to rank — the Smart Match modal renders them
    // as free-text rename rows. This is the every-extra-has-a-timecode
    // case (e.g. the Shrek 2 DVDCompare page).
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [],
        unrenamedFiles: [
          {
            filename: "MOVIE_t23",
            extension: ".mkv",
            durationSeconds: 600,
          },
        ],
      }),
    ).toEqual([
      {
        filename: "MOVIE_t23",
        extension: ".mkv",
        durationSeconds: 600,
        rankedCandidates: [],
      },
    ])
  })

  test("returns a ScoredCandidate list for each unnamed file when both lists are non-empty", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "MOVIE_t23",
          extension: ".mkv",
          durationSeconds: 600,
        },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe("MOVIE_t23")
    expect(result[0].extension).toBe(".mkv")
    expect(result[0].durationSeconds).toBe(600)
    expect(result[0].rankedCandidates).toHaveLength(1)
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Image Gallery")
    expect(
      result[0].rankedCandidates[0].confidence,
    ).toBeGreaterThanOrEqual(0)
  })

  test("threads durationSeconds through each entry, including null when mediainfo couldn't resolve one", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1",
          extension: ".mkv",
          durationSeconds: 150,
        },
        {
          filename: "BONUS_2",
          extension: ".mkv",
          durationSeconds: null,
        },
      ],
    })
    expect(result[0].durationSeconds).toBe(150)
    expect(result[1].durationSeconds).toBeNull()
  })

  test("ranks candidates with strong duration proximity ahead of filename-only matches", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: undefined },
        { name: "Theatrical Cut", timecode: "1:30:00" },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1",
          extension: ".mkv",
          durationSeconds: 5400,
        },
      ],
    })
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Theatrical Cut")
  })

  test("ranks candidates that share more words with the filename first when no durations are available", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        {
          name: "Promotional Featurette",
          timecode: undefined,
        },
        {
          name: "Image Gallery (1200 images)",
          timecode: undefined,
        },
        { name: "Deleted Scenes", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "image-gallery-extra",
          extension: ".mkv",
          durationSeconds: 30,
        },
      ],
    })
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Image Gallery (1200 images)")
  })

  test("produces one entry per unnamed file, each with the full candidate list", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Deleted Scene", timecode: undefined },
        { name: "Featurette", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "MOVIE_t01",
          extension: ".mkv",
          durationSeconds: 120,
        },
        {
          filename: "MOVIE_t02",
          extension: ".mkv",
          durationSeconds: 240,
        },
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0].rankedCandidates).toHaveLength(2)
    expect(result[1].rankedCandidates).toHaveLength(2)
  })

  test("preserves the timecode slot on each candidate through ranking", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: "0:02:30" },
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1",
          extension: ".mkv",
          durationSeconds: 150,
        },
      ],
    })
    const trailer = result[0].rankedCandidates.find(
      (entry) => entry.candidate.name === "Trailer",
    )
    expect(trailer?.candidate.timecode).toBe("0:02:30")
  })

  test("applies the order-based tie-break — at fileIndex N, the Nth DVDCompare candidate gets ORDER_BONUS", () => {
    // Three pure filename-only candidates (all confidence 0 here);
    // the order bonus should pick the one at the same position as
    // the file in the sorted-listing.
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Alpha", timecode: undefined },
        { name: "Beta", timecode: undefined },
        { name: "Gamma", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "file0.mkv",
          extension: ".mkv",
          durationSeconds: null,
        },
        {
          filename: "file1.mkv",
          extension: ".mkv",
          durationSeconds: null,
        },
        {
          filename: "file2.mkv",
          extension: ".mkv",
          durationSeconds: null,
        },
      ],
    })
    expect(
      result[0].rankedCandidates[0].candidate.name,
    ).toBe("Alpha")
    expect(
      result[0].rankedCandidates[0].confidence,
    ).toBeCloseTo(ORDER_BONUS, 5)
    expect(
      result[1].rankedCandidates[0].candidate.name,
    ).toBe("Beta")
    expect(
      result[2].rankedCandidates[0].candidate.name,
    ).toBe("Gamma")
  })
})
