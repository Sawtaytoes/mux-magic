import { describe, expect, test } from "vitest"
import type { Cut } from "../tools/parseSpecialFeatures.js"
import { findMatchingCut } from "./nameSpecialFeaturesDvdCompareTmdb.timecode.js"

describe(findMatchingCut.name, () => {
  test("returns null when no cut has a timecode close to the file's", () => {
    const cuts: Cut[] = [
      { name: "Hong Kong", timecode: "1:36:06" },
    ]
    expect(findMatchingCut(cuts, "0:45:12", {})).toBeNull()
  })

  test("finds a cut whose timecode matches within the configured deviation window", () => {
    const cuts: Cut[] = [
      { name: "Hybrid", timecode: "1:48:44" },
    ]
    expect(findMatchingCut(cuts, "1:48:44", {})).toEqual({
      name: "Hybrid",
      timecode: "1:48:44",
    })
  })

  test("ignores cuts that have no timecode (can't match by timecode if there isn't one)", () => {
    const cuts: Cut[] = [
      { name: "Director's Cut", timecode: undefined },
    ]
    expect(findMatchingCut(cuts, "1:54:42", {})).toBeNull()
  })

  test("uses a wider built-in window than extras so typical 5-10s rip drift still matches", () => {
    // Real-world deltas observed on a Dragon Lord 4K rip:
    // file 1:43:09 vs DVDCompare's Extended Version 1:43:02 → 7s off.
    // The default deviation passed in by the route is { padding: 2 }
    // (from the schema), but findMatchingCut bumps that to its
    // built-in floor (15s) for cut matching.
    const cuts: Cut[] = [
      { name: "Hong Kong Version", timecode: "1:36:06" },
      {
        name: "English Export Version",
        timecode: "1:30:50",
      },
      { name: "Extended Version", timecode: "1:43:02" },
      { name: "Hybrid Version", timecode: "1:48:44" },
    ]
    expect(
      findMatchingCut(cuts, "1:43:09", {
        timecodePaddingAmount: 2,
      }),
    ).toEqual({
      name: "Extended Version",
      timecode: "1:43:02",
    })
    expect(
      findMatchingCut(cuts, "1:30:54", {
        timecodePaddingAmount: 2,
      }),
    ).toEqual({
      name: "English Export Version",
      timecode: "1:30:50",
    })
  })

  test("an explicit larger padding from the caller still wins (Math.max with the floor)", () => {
    const cuts: Cut[] = [
      { name: "Anniversary", timecode: "2:00:00" },
    ]
    // The 30s explicit padding catches a 25s drift even though that's
    // beyond the 15s built-in floor.
    expect(
      findMatchingCut(cuts, "1:59:35", {
        timecodePaddingAmount: 30,
      }),
    ).toEqual({ name: "Anniversary", timecode: "2:00:00" })
  })
})
