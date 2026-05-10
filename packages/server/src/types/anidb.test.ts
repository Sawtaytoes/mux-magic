import { describe, expect, test } from "vitest"

import {
  anidbLengthTolerance,
  effectiveDurationDeltaMinutes,
  episodeTypesForCategory,
  epnoOrderingValue,
  isPickerCategory,
  letterPrefixForType,
} from "./anidb.js"

describe("episodeTypesForCategory", () => {
  test.each([
    ["regular", [1]],
    ["specials", [2]],
    ["credits", [3]],
    ["trailers", [4]],
    ["parodies", [5]],
    ["others", [6]],
  ] as const)("%s maps to AniDB type=%j", (category, expected) => {
    expect(episodeTypesForCategory(category)).toEqual(
      expected,
    )
  })
})

describe("isPickerCategory", () => {
  // The picker categories are the ones that drop into
  // matchSpecialsToFiles (length-matched per-file picker). Regular
  // and others are index-paired — they should NOT be picker
  // categories.
  test.each([
    ["regular", false],
    ["others", false],
    ["specials", true],
    ["credits", true],
    ["trailers", true],
    ["parodies", true],
  ] as const)("%s → %s", (category, expected) => {
    expect(isPickerCategory(category)).toBe(expected)
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
      .map(([type, epno]) => ({
        epno,
        ordering: epnoOrderingValue(
          type as 2 | 3 | 4 | 5,
          epno,
        ),
      }))
      .sort(
        (itemA, itemB) => itemA.ordering - itemB.ordering,
      )
      .map((entry) => entry.epno)
    expect(sorted).toEqual([
      "S1",
      "S20",
      "T1",
      "C1",
      "C2",
      "P1",
    ])
  })

  test("others (type=6, O-prefix) sort numerically within their range", () => {
    expect(epnoOrderingValue(6, "O1")).toBe(401)
    expect(epnoOrderingValue(6, "O13")).toBe(413)
    // O1 < O2 < ... < O13 — Number-stripping handles multi-digit.
    const epnos = ["O3", "O1", "O13", "O2", "O10"]
    const sorted = epnos
      .map((epno) => ({
        epno,
        ordering: epnoOrderingValue(6, epno),
      }))
      .sort(
        (itemA, itemB) => itemA.ordering - itemB.ordering,
      )
      .map((entry) => entry.epno)
    expect(sorted).toEqual(["O1", "O2", "O3", "O10", "O13"])
  })

  test("malformed epno (no digits) falls back to base", () => {
    // Defensive guard — if AniDB ever ships an epno without a numeric
    // tail, we still return the type's base offset rather than NaN.
    expect(epnoOrderingValue(2, "S")).toBe(100)
  })
})

describe("anidbLengthTolerance", () => {
  test.each([
    [1, 1],
    [13, 1],
    [15, 1],
    [16, 5],
    [25, 5],
    [120, 5],
  ])("length %im → tolerance %im", (length, expected) => {
    expect(anidbLengthTolerance(length)).toBe(expected)
  })
})

describe("effectiveDurationDeltaMinutes", () => {
  // Below the breakpoint AniDB rounds to whole minutes — a 13m AniDB
  // length came from an actual duration in (12, 13]. Anything else
  // is a real Δ.
  test("under 16m: file inside the 1-minute round-up window → 0", () => {
    expect(effectiveDurationDeltaMinutes(13, 13)).toBe(0)
  })

  test("under 16m: file 1m short of the boundary → 1", () => {
    // file=12, anidb=13 → window (12, 13], 12 is at the exclusive
    // lower edge, distance = 13 - 12 - (13-1) + 12 = ...
    // simpler: window starts above 12, so 12 is one minute outside.
    expect(effectiveDurationDeltaMinutes(12, 13)).toBe(1)
  })

  // At 16m+ AniDB rounds to multiples of 5, so a 35m AniDB length
  // came from somewhere in (30, 35]. A 32m file lines up with that
  // window — should be 0 delta.
  test("16m+: file 3m below the AniDB length is within the 5m window → 0", () => {
    expect(effectiveDurationDeltaMinutes(32, 35)).toBe(0)
  })

  test("16m+: file at exactly the lower edge of the window → 1m delta", () => {
    expect(effectiveDurationDeltaMinutes(30, 35)).toBe(1)
  })

  test("16m+: file far outside the window reports the actual gap", () => {
    expect(effectiveDurationDeltaMinutes(20, 35)).toBe(11)
  })

  test("file longer than the AniDB length reports the surplus", () => {
    // A 40m file vs a 35m AniDB length — the rounding always goes
    // UP, so a longer file is always outside the window on the high
    // side. Distance is straight subtraction.
    expect(effectiveDurationDeltaMinutes(40, 35)).toBe(5)
  })
})
