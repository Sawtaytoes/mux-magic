import { describe, expect, test } from "vitest"

import { applyRenameRegex } from "./applyRenameRegex.js"

describe(applyRenameRegex.name, () => {
  test("returns the input unchanged when renameRegex is undefined", () => {
    expect(
      applyRenameRegex("My Show - 01.mkv", undefined),
    ).toBe("My Show - 01.mkv")
  })

  test("returns the input unchanged when the pattern does not match", () => {
    expect(
      applyRenameRegex("My Show - 01.mkv", {
        pattern: "^\\[Group\\] ",
        replacement: "",
      }),
    ).toBe("My Show - 01.mkv")
  })

  test("applies a simple replacement", () => {
    expect(
      applyRenameRegex("[Group] My Show - 01.mkv", {
        pattern: "^\\[Group\\] ",
        replacement: "",
      }),
    ).toBe("My Show - 01.mkv")
  })

  test("supports numbered capture groups", () => {
    expect(
      applyRenameRegex(
        "[Group] My Show - 01 [1080p].mkv",
        {
          pattern:
            "^\\[.*?\\] (.+?) \\[.*?\\](\\.\\w+)$",
          replacement: "$1$2",
        },
      ),
    ).toBe("My Show - 01.mkv")
  })

  test("supports named capture groups", () => {
    expect(
      applyRenameRegex("Show.s01e03.Episode.mkv", {
        pattern:
          "^(?<series>.+?)\\.(?<season>s\\d+)(?<episode>e\\d+)\\.(?<title>.+)\\.mkv$",
        replacement:
          "$<series> - $<season>$<episode> - $<title>.mkv",
      }),
    ).toBe("Show - s01e03 - Episode.mkv")
  })
})
