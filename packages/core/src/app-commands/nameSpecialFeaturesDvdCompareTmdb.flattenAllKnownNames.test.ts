import { describe, expect, test } from "vitest"
import type { SpecialFeature } from "../tools/parseSpecialFeatures.js"
import { flattenAllKnownNames } from "./nameSpecialFeaturesDvdCompareTmdb.flattenAllKnownNames.js"

const makeExtra = (
  text: string,
  options: { children?: string[]; timecode?: string } = {},
): SpecialFeature => ({
  text,
  type: "unknown",
  parentType: "unknown",
  timecode: options.timecode,
  children: options.children?.map((childText) => ({
    text: childText,
    type: "unknown",
    parentType: "unknown",
  })),
})

describe(flattenAllKnownNames.name, () => {
  test("returns extras parents and children in scrape order, then cuts, then untimed suggestions, deduped", () => {
    const result = flattenAllKnownNames({
      cuts: [
        { name: "Director's Cut", timecode: undefined },
        { name: "Theatrical", timecode: "1:30:00" },
      ],
      extras: [
        makeExtra("Featurette A", {
          timecode: "0:10:00",
          children: ["Sub A1", "Sub A2"],
        }),
        makeExtra("Photo Gallery"),
      ],
      possibleNames: [
        { name: "Photo Gallery", timecode: undefined },
        {
          name: "Image Gallery (300 images)",
          timecode: undefined,
        },
      ],
    })
    expect(result).toEqual([
      "Featurette A",
      "Sub A1",
      "Sub A2",
      "Photo Gallery",
      "Director's Cut",
      "Theatrical",
      "Image Gallery (300 images)",
    ])
  })

  test("drops empty cut names and empty / whitespace-only labels", () => {
    const result = flattenAllKnownNames({
      cuts: [
        { name: "", timecode: undefined },
        { name: "Hong Kong Version", timecode: undefined },
      ],
      extras: [makeExtra("  Image Gallery  ")],
      possibleNames: [{ name: "", timecode: undefined }],
    })
    expect(result).toEqual([
      "Image Gallery",
      "Hong Kong Version",
    ])
  })

  test("returns an empty array when nothing was parsed", () => {
    expect(
      flattenAllKnownNames({
        cuts: [],
        extras: [],
        possibleNames: [],
      }),
    ).toEqual([])
  })
})
