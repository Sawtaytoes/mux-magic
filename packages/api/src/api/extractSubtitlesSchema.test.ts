import { describe, expect, test } from "vitest"
import { extractSubtitlesRequestSchema } from "./schemas.js"

describe("extractSubtitlesRequestSchema", () => {
  test("defaults supply empty languages array, none mode, empty types", () => {
    const parsed = extractSubtitlesRequestSchema.parse({
      sourcePath: "/work",
    })
    expect(parsed.subtitlesLanguages).toEqual([])
    expect(parsed.typesMode).toBe("none")
    expect(parsed.subtitleTypes).toEqual([])
  })

  test("accepts include mode with non-empty subtitleTypes", () => {
    const parsed = extractSubtitlesRequestSchema.parse({
      sourcePath: "/work",
      typesMode: "include",
      subtitleTypes: ["ass"],
    })
    expect(parsed.typesMode).toBe("include")
    expect(parsed.subtitleTypes).toEqual(["ass"])
  })

  test("rejects unknown subtitle types", () => {
    expect(() =>
      extractSubtitlesRequestSchema.parse({
        sourcePath: "/work",
        subtitleTypes: ["unknown"],
      }),
    ).toThrow()
  })

  test("rejects unknown typesMode values", () => {
    expect(() =>
      extractSubtitlesRequestSchema.parse({
        sourcePath: "/work",
        typesMode: "filter",
      }),
    ).toThrow()
  })

  test("rejects the legacy singular subtitlesLanguage field shape", () => {
    // The legacy `subtitlesLanguage: "eng"` field is no longer in the
    // schema. Zod treats unknown keys as a no-op (strip), so the parse
    // succeeds — but the new `subtitlesLanguages` array stays empty,
    // which is the documented "all languages" behavior. Saved sequences
    // that relied on `subtitlesLanguage: "eng"` to NARROW will now extract
    // every language; the worker calls this out as a breaking change.
    const parsed = extractSubtitlesRequestSchema.parse({
      sourcePath: "/work",
      subtitlesLanguage: "eng",
    })
    expect(parsed.subtitlesLanguages).toEqual([])
  })
})
