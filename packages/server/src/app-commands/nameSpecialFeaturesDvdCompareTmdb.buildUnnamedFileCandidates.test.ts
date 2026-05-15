import { describe, expect, test } from "vitest"
import { buildUnnamedFileCandidates } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"

describe(buildUnnamedFileCandidates.name, () => {
  test("returns empty when there are no unnamed files", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [
          { name: "Image Gallery", timecode: undefined },
        ],
        unrenamedFilenames: [],
      }),
    ).toEqual([])
  })

  test("returns empty when there are no possible-name suggestions", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [],
        unrenamedFilenames: ["MOVIE_t23.mkv"],
      }),
    ).toEqual([])
  })

  test("returns a candidate list for each unnamed file when both lists are non-empty", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFilenames: ["MOVIE_t23.mkv"],
    })
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe("MOVIE_t23.mkv")
    expect(result[0].candidates).toEqual(["Image Gallery"])
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
      unrenamedFilenames: ["image-gallery-extra.mkv"],
    })
    // "Image Gallery" shares 'image' and 'gallery' with the stem — should
    // rank above "Promotional Featurette" and "Deleted Scenes" (0 shared words).
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
      unrenamedFilenames: [
        "MOVIE_t01.mkv",
        "MOVIE_t02.mkv",
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0].candidates).toHaveLength(2)
    expect(result[1].candidates).toHaveLength(2)
  })

  test("preserves the timecode slot on each PossibleName entry through the call (currently unused but reserved for the smart-suggestion modal)", () => {
    // The candidates list is just names today, but the input shape carries
    // timecode info forward so callers can pair the file with the original
    // PossibleName entry for duration-proximity scoring on the client.
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: "0:02:30" },
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFilenames: ["BONUS_1.mkv"],
    })
    // Sanity — both candidate names made it through; the helper still
    // returns just names (timecodes are consumed elsewhere).
    expect(result[0].candidates).toContain("Trailer")
    expect(result[0].candidates).toContain("Image Gallery")
  })
})
