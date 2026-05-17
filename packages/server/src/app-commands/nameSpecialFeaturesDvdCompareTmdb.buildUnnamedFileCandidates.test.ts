import { describe, expect, test } from "vitest"
import { buildUnnamedFileCandidates } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"

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

  test("returns empty when there are no possible-name suggestions", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [],
        unrenamedFiles: [
          {
            filename: "MOVIE_t23.mkv",
            durationSeconds: 600,
          },
        ],
      }),
    ).toEqual([])
  })

  test("returns a candidate list for each unnamed file when both lists are non-empty", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "MOVIE_t23.mkv",
          durationSeconds: 600,
        },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe("MOVIE_t23.mkv")
    expect(result[0].durationSeconds).toBe(600)
    expect(result[0].candidates).toEqual(["Image Gallery"])
  })

  test("threads durationSeconds through each entry, including null when mediainfo couldn't resolve one", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1.mkv",
          durationSeconds: 150,
        },
        {
          filename: "BONUS_2.mkv",
          durationSeconds: null,
        },
      ],
    })
    expect(result[0].durationSeconds).toBe(150)
    expect(result[1].durationSeconds).toBeNull()
  })

  test("ranks candidates that share more words with the filename first", () => {
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
          filename: "image-gallery-extra.mkv",
          durationSeconds: 30,
        },
      ],
    })
    expect(result[0].candidates[0]).toBe(
      "Image Gallery (1200 images)",
    )
  })

  test("produces one entry per unnamed file, each with the full candidate list", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Deleted Scene", timecode: undefined },
        { name: "Featurette", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "MOVIE_t01.mkv",
          durationSeconds: 120,
        },
        {
          filename: "MOVIE_t02.mkv",
          durationSeconds: 240,
        },
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0].candidates).toHaveLength(2)
    expect(result[1].candidates).toHaveLength(2)
  })

  test("preserves the timecode slot on each PossibleName entry through the call (currently unused for ranking but reserved for the web-side smart-match modal)", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: "0:02:30" },
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFiles: [
        {
          filename: "BONUS_1.mkv",
          durationSeconds: 150,
        },
      ],
    })
    expect(result[0].candidates).toContain("Trailer")
    expect(result[0].candidates).toContain("Image Gallery")
  })
})
