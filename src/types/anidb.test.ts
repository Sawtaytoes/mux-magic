import { describe, expect, test } from "vitest"

import {
  episodeTypesForCategory,
  epnoOrderingValue,
  letterPrefixForType,
} from "./anidb.js"

describe("episodeTypesForCategory", () => {
  test("regular maps to type=1 only", () => {
    expect(episodeTypesForCategory("regular")).toEqual([1])
  })

  test("specials covers types 2-5 (S/C/T/P)", () => {
    expect(episodeTypesForCategory("specials")).toEqual([2, 3, 4, 5])
  })

  test("others covers type=6 only", () => {
    expect(episodeTypesForCategory("others")).toEqual([6])
  })
})

describe("letterPrefixForType", () => {
  test.each([
    [1, ""],
    [2, "S"],
    [3, "C"],
    [4, "T"],
    [5, "P"],
    [6, "O"],
  ] as const)("type %i → %j", (type, expected) => {
    expect(letterPrefixForType(type)).toBe(expected)
  })
})

describe("epnoOrderingValue", () => {
  // Regular epnos are plain numbers and keep their natural order so a
  // sorted regular run still hits "1, 2, 3, ..." after the synthesis.
  test("regular epnos keep their natural ordering", () => {
    expect(epnoOrderingValue(1, "1")).toBe(1)
    expect(epnoOrderingValue(1, "12")).toBe(12)
    expect(epnoOrderingValue(1, "25")).toBe(25)
  })

  test("specials sort grouped by type: S → T → C → P", () => {
    // The hundreds-digit scheme groups specials so a list with mixed
    // S/C/T/P sorts S* (1xx) → T* (2xx) → C* (3xx) → P* (5xx). This
    // matches AniDB's natural display order.
    const epnos: [number, string][] = [
      [3, "C2"],
      [2, "S20"],
      [4, "T1"],
      [3, "C1"],
      [2, "S1"],
      [5, "P1"],
    ]
    const sorted = epnos
      .map(([type, epno]) => ({ epno, ordering: epnoOrderingValue(type as 2 | 3 | 4 | 5, epno) }))
      .sort((a, b) => a.ordering - b.ordering)
      .map((entry) => entry.epno)
    expect(sorted).toEqual(["S1", "S20", "T1", "C1", "C2", "P1"])
  })

  test("others (type=6, O-prefix) sort numerically within their range", () => {
    expect(epnoOrderingValue(6, "O1")).toBe(401)
    expect(epnoOrderingValue(6, "O13")).toBe(413)
    // O1 < O2 < ... < O13 — Number-stripping handles multi-digit.
    const epnos = ["O3", "O1", "O13", "O2", "O10"]
    const sorted = epnos
      .map((epno) => ({ epno, ordering: epnoOrderingValue(6, epno) }))
      .sort((a, b) => a.ordering - b.ordering)
      .map((entry) => entry.epno)
    expect(sorted).toEqual(["O1", "O2", "O3", "O10", "O13"])
  })

  test("malformed epno (no digits) falls back to base", () => {
    // Defensive guard — if AniDB ever ships an epno without a numeric
    // tail, we still return the type's base offset rather than NaN.
    expect(epnoOrderingValue(2, "S")).toBe(100)
  })
})
