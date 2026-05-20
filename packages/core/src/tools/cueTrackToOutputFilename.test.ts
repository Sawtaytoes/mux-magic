import { describe, expect, test } from "vitest"
import { cueTrackToOutputFilename } from "./cueTrackToOutputFilename.js"

describe(cueTrackToOutputFilename.name, () => {
  test("zero-pads single-digit track numbers", () => {
    expect(cueTrackToOutputFilename(1, "Hello")).toBe(
      "01 - Hello.flac",
    )
  })

  test("strips Windows-reserved characters from the title", () => {
    expect(
      cueTrackToOutputFilename(12, 'AC/DC: Back in Black'),
    ).toBe("12 - ACDC Back in Black.flac")
  })

  test("collapses repeated whitespace into a single space", () => {
    expect(
      cueTrackToOutputFilename(3, "Track   With   Spaces"),
    ).toBe("03 - Track With Spaces.flac")
  })

  test("preserves non-Latin characters (Shift_JIS-friendly)", () => {
    expect(cueTrackToOutputFilename(5, "残酷な天使のテーゼ")).toBe(
      "05 - 残酷な天使のテーゼ.flac",
    )
  })

  test("throws on track number 0 with a clear message", () => {
    expect(() => cueTrackToOutputFilename(0, "Anything"))
      .toThrowError(/track number/i)
  })

  test("throws on an empty title with a clear message", () => {
    expect(() => cueTrackToOutputFilename(1, "")).toThrowError(
      /title/i,
    )
  })

  test("throws on a title that is only reserved chars", () => {
    expect(() => cueTrackToOutputFilename(1, "///")).toThrowError(
      /title/i,
    )
  })
})
