import { describe, expect, test } from "vitest"
import {
  languageSelectionSchema,
  normalizeLanguageSelection,
} from "./languageSelection.js"

describe("normalizeLanguageSelection", () => {
  test("promotes bare string to object form", () => {
    expect(normalizeLanguageSelection("eng")).toEqual({
      code: "eng",
    })
  })

  test("passes object with code through unchanged", () => {
    expect(
      normalizeLanguageSelection({ code: "jpn" }),
    ).toEqual({ code: "jpn" })
  })

  test("passes object with code + ietf through unchanged", () => {
    expect(
      normalizeLanguageSelection({
        code: "chi",
        ietf: "zh-Hant-HK",
      }),
    ).toEqual({ code: "chi", ietf: "zh-Hant-HK" })
  })
})

describe("languageSelectionSchema", () => {
  test("parses bare string 'eng' to object form", () => {
    const result = languageSelectionSchema.parse("eng")
    expect(result).toEqual({ code: "eng" })
  })

  test("parses bare string 'chi' to object form", () => {
    const result = languageSelectionSchema.parse("chi")
    expect(result).toEqual({ code: "chi" })
  })

  test("parses object { code: 'jpn' } as-is", () => {
    const result = languageSelectionSchema.parse({
      code: "jpn",
    })
    expect(result).toEqual({ code: "jpn" })
  })

  test("parses object { code: 'chi', ietf: 'zh-Hant-HK' }", () => {
    const result = languageSelectionSchema.parse({
      code: "chi",
      ietf: "zh-Hant-HK",
    })
    expect(result).toEqual({
      code: "chi",
      ietf: "zh-Hant-HK",
    })
  })

  test("rejects an invalid code", () => {
    expect(() =>
      languageSelectionSchema.parse("xyz"),
    ).toThrow()
  })

  test("rejects an invalid ietf tag", () => {
    expect(() =>
      languageSelectionSchema.parse({
        code: "chi",
        ietf: "not-a-real-tag",
      }),
    ).toThrow()
  })

  test("omitting ietf leaves it undefined in output", () => {
    const result = languageSelectionSchema.parse({
      code: "por",
    })
    expect(result.ietf).toBeUndefined()
  })
})
