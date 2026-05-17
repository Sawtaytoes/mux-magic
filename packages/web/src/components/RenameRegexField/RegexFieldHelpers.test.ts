import { describe, expect, test } from "vitest"
import {
  formatSlashLiteral,
  parseSlashLiteral,
  runLivePreview,
  safeBuildRegex,
  validateRegexFlags,
} from "./RegexFieldHelpers"

describe("validateRegexFlags", () => {
  test("accepts the empty string", () => {
    expect(validateRegexFlags("")).toEqual({
      isValid: true,
      invalidChars: "",
    })
  })

  test("accepts any subset of g/i/m/s/u/y", () => {
    expect(validateRegexFlags("gimsuy")).toEqual({
      isValid: true,
      invalidChars: "",
    })
  })

  test("rejects d (hasIndices) and any other char, deduping the report", () => {
    expect(validateRegexFlags("idziz")).toEqual({
      isValid: false,
      invalidChars: "dz",
    })
  })
})

describe("safeBuildRegex", () => {
  test("returns null + null when pattern is empty (preview is collapsed)", () => {
    expect(safeBuildRegex("", "i")).toEqual({
      regex: null,
      error: null,
    })
  })

  test("returns a RegExp when pattern + flags are valid", () => {
    const { regex, error } = safeBuildRegex("foo", "i")
    expect(error).toBeNull()
    expect(regex).toBeInstanceOf(RegExp)
    expect(regex?.flags).toBe("i")
  })

  test("swallows pattern syntax errors as { regex: null, error: <message> }", () => {
    const result = safeBuildRegex("(unclosed", "")
    expect(result.regex).toBeNull()
    expect(result.error).toMatch(/regular expression/i)
  })

  test("surfaces invalid-flag chars without throwing", () => {
    const result = safeBuildRegex("foo", "z")
    expect(result.regex).toBeNull()
    expect(result.error).toContain("z")
  })
})

describe("formatSlashLiteral / parseSlashLiteral round-trip", () => {
  test("trivial pattern with no slashes", () => {
    const literal = formatSlashLiteral("foo", "i")
    expect(literal).toBe("/foo/i")
    expect(parseSlashLiteral(literal)).toEqual({
      pattern: "foo",
      flags: "i",
    })
  })

  test("pattern containing a forward slash is escaped + round-tripped", () => {
    const literal = formatSlashLiteral("a/b", "g")
    expect(literal).toBe("/a\\/b/g")
    expect(parseSlashLiteral(literal)).toEqual({
      pattern: "a/b",
      flags: "g",
    })
  })

  test("user-typed input without leading slash is tolerated", () => {
    expect(parseSlashLiteral("foo/i")).toEqual({
      pattern: "foo",
      flags: "i",
    })
  })

  test("no trailing delimiter — everything is the pattern", () => {
    expect(parseSlashLiteral("/foo")).toEqual({
      pattern: "foo",
      flags: "",
    })
  })
})

describe("runLivePreview", () => {
  test("empty sample → empty state", () => {
    expect(
      runLivePreview({
        pattern: "foo",
        flags: "",
        sample: "",
      }),
    ).toEqual({ state: "empty" })
  })

  test("matching sample without replacement (filter mode)", () => {
    const result = runLivePreview({
      pattern: "^(?<name>[a-z]+)",
      flags: "",
      sample: "foo bar",
    })
    expect(result.state).toBe("match")
    if (result.state !== "match") return
    expect(result.output).toBeNull()
    expect(result.groups).toContainEqual({
      name: "name",
      value: "foo",
    })
    expect(result.groups).toContainEqual({
      name: "1",
      value: "foo",
    })
  })

  test("matching sample with replacement (rename mode)", () => {
    const result = runLivePreview({
      pattern: "^(.+)-(\\d+)\\.mkv$",
      flags: "i",
      replacement: "$1 ep$2.mkv",
      sample: "SHOW-01.MKV",
    })
    expect(result.state).toBe("match")
    if (result.state !== "match") return
    expect(result.output).toBe("SHOW ep01.mkv")
  })

  test("non-matching sample → no-match state", () => {
    expect(
      runLivePreview({
        pattern: "^foo$",
        flags: "",
        sample: "bar",
      }).state,
    ).toBe("no-match")
  })

  test("invalid pattern → invalid state with a useful message", () => {
    const result = runLivePreview({
      pattern: "(unclosed",
      flags: "",
      sample: "anything",
    })
    expect(result.state).toBe("invalid")
  })
})
