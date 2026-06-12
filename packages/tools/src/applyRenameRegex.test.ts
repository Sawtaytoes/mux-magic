import { describe, expect, test } from "vitest"

import { applyRenameRegex } from "./applyRenameRegex.js"

describe(applyRenameRegex.name, () => {
  // ─── Existing single-rule regression ───────────────────────────────────────

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
      applyRenameRegex("[Group] My Show - 01 [1080p].mkv", {
        pattern: "^\\[.*?\\] (.+?) \\[.*?\\](\\.\\w+)$",
        replacement: "$1$2",
      }),
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

  // ─── Chain order ────────────────────────────────────────────────────────────

  test("applies rules left-to-right — Dandadan chain", () => {
    expect(
      applyRenameRegex("Dandadan Vol 1", [
        { pattern: "^Dandadan", replacement: "Dan Da Dan" },
        { pattern: "Dan Da Dan", replacement: "DDD" },
      ]),
    ).toBe("DDD Vol 1")
  })

  test("applies rules left-to-right so rule 2 sees rule 1 output", () => {
    expect(
      applyRenameRegex("Dandadan Vol 1", [
        { pattern: "^Dandadan", replacement: "Dan Da Dan" },
        {
          pattern: "(Centuria) (\\d+)",
          replacement: "$1 c$2",
        },
        { pattern: "\\.([^.]+)$", replacement: "" },
      ]),
    ).toBe("Dan Da Dan Vol 1")
  })

  test("real-world chain: Dandadan + Centuria + ext-strip", () => {
    expect(
      applyRenameRegex("Dandadan - Centuria 12.mkv", [
        { pattern: "^Dandadan", replacement: "Dan Da Dan" },
        {
          pattern: "(Centuria) (\\d+)",
          replacement: "$1 c$2",
        },
        { pattern: "\\.([^.]+)$", replacement: "" },
      ]),
    ).toBe("Dan Da Dan - Centuria c12")
  })

  // ─── Flags propagate per-rule ────────────────────────────────────────────────

  test("per-rule flags — case-insensitive rule 1 does not bleed into rule 2", () => {
    expect(
      applyRenameRegex("SHOW-01.mkv", [
        {
          pattern: "show",
          replacement: "Series",
          flags: "i",
        },
        { pattern: "SERIES", replacement: "WRONG" },
      ]),
    ).toBe("Series-01.mkv")
  })

  test("per-rule flags — each rule uses its own flags", () => {
    expect(
      applyRenameRegex("hello WORLD", [
        { pattern: "hello", replacement: "Hi", flags: "i" },
        { pattern: "WORLD", replacement: "Earth" },
      ]),
    ).toBe("Hi Earth")
  })

  // ─── Empty / one-element array ──────────────────────────────────────────────

  test("empty array returns the input unchanged", () => {
    expect(applyRenameRegex("My Show - 01.mkv", [])).toBe(
      "My Show - 01.mkv",
    )
  })

  test("one-element array produces identical output to the object form", () => {
    const rule = {
      pattern: "^\\[Group\\] ",
      replacement: "",
    }
    const objectResult = applyRenameRegex(
      "[Group] My Show - 01.mkv",
      rule,
    )
    const arrayResult = applyRenameRegex(
      "[Group] My Show - 01.mkv",
      [rule],
    )
    expect(arrayResult).toBe(objectResult)
  })

  // ─── Bare-object back-compat round-trip ─────────────────────────────────────

  test("bare-object form still accepted and applies correctly", () => {
    expect(
      applyRenameRegex("My Show - 01.mkv", {
        pattern: "My Show",
        replacement: "Your Show",
      }),
    ).toBe("Your Show - 01.mkv")
  })
})
