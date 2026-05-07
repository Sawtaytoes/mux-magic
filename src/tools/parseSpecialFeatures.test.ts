import { firstValueFrom } from "rxjs"
import { describe, expect, test } from "vitest"

import { parseCuts, parseSpecialFeatures, parseUntimedSuggestions } from "./parseSpecialFeatures.js"

describe(parseCuts.name, () => {
  test("returns an empty array for empty input", () => {
    expect(parseCuts("")).toEqual([])
  })

  test("returns an empty array when no `*The Film` lines are present", () => {
    const text = [
      "DISC ONE (Blu-ray)",
      "Audio Commentary by Director (2:14:00)",
      "Behind the Scenes (12:34)",
    ].join("\n")
    expect(parseCuts(text)).toEqual([])
  })

  test("matches both '* The Film' and '*The Film' (DVDCompare emits both)", () => {
    const text = [
      "* The Film (1080p)",
      "*The Film (2160p)",
    ].join("\n")
    // Format-only parens like (1080p) / (2160p) don't carry an edition
    // label and aren't a runtime — they collapse to anonymous cuts.
    expect(parseCuts(text)).toEqual([
      { name: "", timecode: undefined },
      { name: "", timecode: undefined },
    ])
  })

  test("extracts edition + timecode from a typical Dragon Lord-style entry", () => {
    expect(parseCuts("*The Film – Hong Kong Version (96:06)"))
    .toEqual([
      { name: "Hong Kong Version", timecode: "1:36:06" },
    ])
  })

  test("extracts every cut from a multi-line Extras section", () => {
    const text = [
      "DISC ONE (Blu-ray 4K)",
      "*The Film – Hong Kong Version (96:06)",
      "*The Film – English Export Version (90:50)",
      "Audio Commentary (2:00:00)",
      "DISC TWO (Blu-ray 4K)",
      "*The Film - Extended Version (103:02)",
      "*The Film – Hybrid Version (108:44, 1080p)",
    ].join("\n")
    expect(parseCuts(text)).toEqual([
      { name: "Hong Kong Version", timecode: "1:36:06" },
      { name: "English Export Version", timecode: "1:30:50" },
      { name: "Extended Version", timecode: "1:43:02" },
      { name: "Hybrid Version", timecode: "1:48:44" },
    ])
  })

  test("yields a name with no timecode when DVDCompare doesn't publish a runtime", () => {
    expect(parseCuts("* The Film – Director's Cut")).toEqual([
      { name: "Director's Cut", timecode: undefined },
    ])
  })

  test("ignores lines that have 'The Film' in them but don't start with the asterisk marker", () => {
    expect(parseCuts("The Filmography of Jackie Chan featurette (12:00)")).toEqual([])
  })

  test("strips trailing format-only parens after extracting the name + timecode", () => {
    // "1080p" inside the runtime parens is descriptive noise — the
    // timecode-extraction grabs the runtime, the rest is dropped.
    expect(parseCuts("*The Film – Hybrid Version (108:44, 1080p)")).toEqual([
      { name: "Hybrid Version", timecode: "1:48:44" },
    ])
  })
})

describe(`${parseSpecialFeatures.name} — extras vs cuts split`, () => {
  test("emits { extras, cuts } where extras drops the *The Film entries the cuts side picked up", async () => {
    const text = [
      "DISC ONE (Blu-ray 4K)",
      "*The Film – Hong Kong Version (96:06)",
      "*The Film – English Export Version (90:50)",
      'Behind the Scenes Teaser (5:21, in Cantonese with English subtitles)',
      "Hong Kong Theatrical Trailer (4:13)",
    ].join("\n")
    const result = await firstValueFrom(parseSpecialFeatures(text))
    expect(result.cuts).toEqual([
      { name: "Hong Kong Version", timecode: "1:36:06" },
      { name: "English Export Version", timecode: "1:30:50" },
    ])
    expect(result.extras.map((extra) => extra.text)).toEqual([
      expect.stringContaining("Behind the Scenes Teaser"),
      expect.stringContaining("Hong Kong Theatrical Trailer"),
    ])
  })

  test("yields empty arrays for empty input", async () => {
    expect(await firstValueFrom(parseSpecialFeatures("")))
    .toEqual({ extras: [], cuts: [], possibleNames: [] })
  })

  test("includes possibleNames for untimed lines (e.g. image galleries) the main extras filter drops", async () => {
    const text = [
      "DISC ONE (Blu-ray)",
      "Behind the Scenes (12:34)",
      "Image Gallery (96 images)",
      "Photo Gallery (8 pages)",
    ].join("\n")
    const result = await firstValueFrom(parseSpecialFeatures(text))
    expect(result.possibleNames).toEqual([
      "Image Gallery (96 images)",
      "Photo Gallery (8 pages)",
    ])
  })
})

describe(parseUntimedSuggestions.name, () => {
  test("returns an empty array for empty input", () => {
    expect(parseUntimedSuggestions("")).toEqual([])
  })

  test("includes image-gallery lines that the main extras pipeline filters out", () => {
    // The main parseSpecialFeatures filter drops `images)` / `pages)`
    // lines, but those are exactly the candidates the user sees as
    // leftover files. Surfaced here so the rename summary can suggest
    // them.
    const text = [
      "DISC ONE (Blu-ray)",
      "Image Gallery (96 images)",
      "Photo Gallery (8 pages)",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual([
      "Image Gallery (96 images)",
      "Photo Gallery (8 pages)",
    ])
  })

  test("includes untimed *The Film cut lines (per the user's pick to surface those as suggestions)", () => {
    const text = [
      "* The Film – Director's Cut",
      "Behind the Scenes (12:34)",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual([
      "* The Film – Director's Cut",
    ])
  })

  test("excludes lines with a timecode (those could match by timecode)", () => {
    const text = [
      "Behind the Scenes (12:34)",
      "Trailer (2:00)",
      "Audio Commentary (1:30:00)",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual([])
  })

  test("excludes DISC headers", () => {
    const text = [
      "DISC ONE (Blu-ray)",
      "DISC TWO (Blu-ray)",
      "Some Untimed Extra",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual(["Some Untimed Extra"])
  })

  test("strips leading dash bullets on extras but preserves the *The Film cut prefix", () => {
    const text = [
      "- Image Gallery (8 pages)",
      "* The Film – Hong Kong Version",
      "– Sub-extra without a timecode",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual([
      "Image Gallery (8 pages)",
      "* The Film – Hong Kong Version",
      "Sub-extra without a timecode",
    ])
  })

  test("does not deduplicate (e.g. an Image Gallery on each disc shows twice)", () => {
    const text = [
      "DISC ONE (Blu-ray)",
      "Image Gallery (4 images)",
      "DISC TWO (Blu-ray)",
      "Image Gallery (4 images)",
    ].join("\n")
    expect(parseUntimedSuggestions(text)).toEqual([
      "Image Gallery (4 images)",
      "Image Gallery (4 images)",
    ])
  })
})
