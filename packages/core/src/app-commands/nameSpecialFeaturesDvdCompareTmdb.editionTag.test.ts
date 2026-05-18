import { describe, expect, test } from "vitest"
import {
  isMainFeatureFilename,
  parseEditionFromFilename,
} from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"

describe(parseEditionFromFilename.name, () => {
  test("extracts the edition string from a filename with a {edition-…} tag", () => {
    expect(
      parseEditionFromFilename(
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    ).toBe("Hong Kong Version")
  })

  test("returns null when the filename has no {edition-…} tag", () => {
    expect(
      parseEditionFromFilename("Dragon Lord (1982).mkv"),
    ).toBeNull()
  })

  test("works on a bare stem (no extension)", () => {
    expect(
      parseEditionFromFilename(
        "Dragon Lord (1982) {edition-Director's Cut}",
      ),
    ).toBe("Director's Cut")
  })

  test("returns null for a special-feature filename that looks similar", () => {
    // Plex suffix present — there's no {edition-…} block here anyway
    expect(
      parseEditionFromFilename(
        "Making Of -behindthescenes.mkv",
      ),
    ).toBeNull()
  })
})

describe(isMainFeatureFilename.name, () => {
  test("returns true for a plain 'Title (Year)' filename", () => {
    expect(
      isMainFeatureFilename("Dragon Lord (1982).mkv"),
    ).toBe(true)
  })

  test("returns true for a 'Title (Year) {edition-…}' filename", () => {
    expect(
      isMainFeatureFilename(
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    ).toBe(true)
  })

  test("returns false for a file ending in -trailer", () => {
    expect(
      isMainFeatureFilename(
        "Theatrical Trailer -trailer.mkv",
      ),
    ).toBe(false)
  })

  test("returns false for a file ending in -behindthescenes", () => {
    expect(
      isMainFeatureFilename(
        "Making Of -behindthescenes.mkv",
      ),
    ).toBe(false)
  })

  test("returns false for a file ending in -featurette", () => {
    expect(
      isMainFeatureFilename("EPK -featurette.mkv"),
    ).toBe(false)
  })

  test("returns false for a file ending in -deleted", () => {
    expect(
      isMainFeatureFilename("Cut Scene -deleted.mkv"),
    ).toBe(false)
  })

  test("returns false for a file ending in -interview", () => {
    expect(
      isMainFeatureFilename("Director Chat -interview.mkv"),
    ).toBe(false)
  })

  test("returns false for a file ending in -scene", () => {
    expect(
      isMainFeatureFilename("Opening Scene -scene.mkv"),
    ).toBe(false)
  })

  test("returns false for a file ending in -short", () => {
    expect(
      isMainFeatureFilename("Short Film -short.mkv"),
    ).toBe(false)
  })

  test("returns false for a file ending in -other", () => {
    expect(
      isMainFeatureFilename("Storyboard -other.mkv"),
    ).toBe(false)
  })
})
