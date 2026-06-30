import { describe, expect, test } from "vitest"
import * as schemas from "./schemas.js"

// Regression: the web Builder's "Release Hash" field carries a UI default
// of 1, and buildParams strips any field value equal to its default on the
// assumption the schema's .default() will re-apply it server-side. The
// DVDCompare schemas previously left dvdCompareReleaseHash as
// `.optional()` with NO `.default()`, so a user-pinned hash of 1 was
// dropped entirely. The command then saw `dvdCompareReleaseHash:
// undefined` with a `dvdCompareId` set and fell into resolveUrl's
// "fetch the release list and prompt the user" branch — re-prompting for a
// release the user had already pinned.
//
// Fix: give the schema a real `.default(1)` so the field default and the
// schema default agree (closing the drift the buildFields audit warns
// about), and the omitted-but-defaulted value resolves the URL directly.

describe("dvdCompareReleaseHash schema default", () => {
  const cases = [
    [
      "nameSpecialFeaturesDvdCompareTmdb",
      schemas.nameSpecialFeaturesDvdCompareTmdbRequestSchema,
    ],
    [
      "onlyNameSpecialFeaturesDvdCompare",
      schemas.onlyNameSpecialFeaturesDvdCompareRequestSchema,
    ],
    [
      "nameMovieCutsDvdCompareTmdb",
      schemas.nameMovieCutsDvdCompareTmdbRequestSchema,
    ],
  ] as const

  test.each(
    cases,
  )("%s defaults dvdCompareReleaseHash to 1 when omitted", (_name, schema) => {
    const parsed = schema.parse({
      sourcePath: "/media/movie",
      dvdCompareId: 57663,
    })
    expect(parsed.dvdCompareReleaseHash).toBe(1)
  })

  test.each(
    cases,
  )("%s preserves an explicitly-provided dvdCompareReleaseHash", (_name, schema) => {
    const parsed = schema.parse({
      sourcePath: "/media/movie",
      dvdCompareId: 57663,
      dvdCompareReleaseHash: 4,
    })
    expect(parsed.dvdCompareReleaseHash).toBe(4)
  })
})
