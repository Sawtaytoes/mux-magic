import { describe, expect, test } from "vitest"
import { findSiblingsForEdition } from "./nameSpecialFeaturesDvdCompareTmdb.findSiblingsForEdition.js"

describe(findSiblingsForEdition.name, () => {
  test("returns an empty array when no sibling files exist", () => {
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        allFilenamesInFolder: [
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        ],
      }),
    ).toEqual([])
  })

  test("returns trailer that shares the main feature's base name", () => {
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        allFilenamesInFolder: [
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
          "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
        ],
      }),
    ).toEqual([
      "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
    ])
  })

  test("returns behind-the-scenes that shares the main feature's base name", () => {
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        allFilenamesInFolder: [
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
          "Dragon Lord (1982) {edition-Hong Kong Version}-behindthescenes.mkv",
        ],
      }),
    ).toEqual([
      "Dragon Lord (1982) {edition-Hong Kong Version}-behindthescenes.mkv",
    ])
  })

  test("returns multiple sibling types for the same edition", () => {
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        allFilenamesInFolder: [
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
          "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
          "Dragon Lord (1982) {edition-Hong Kong Version}-behindthescenes.mkv",
        ],
      }),
    ).toEqual([
      "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      "Dragon Lord (1982) {edition-Hong Kong Version}-behindthescenes.mkv",
    ])
  })

  test("does not return siblings belonging to a different edition", () => {
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        allFilenamesInFolder: [
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
          "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
          "Dragon Lord (1982) {edition-Theatrical}.mkv",
          "Dragon Lord (1982) {edition-Theatrical}-trailer.mkv",
        ],
      }),
    ).toEqual([
      "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
    ])
  })

  test("scopes correctly across two editions in the same folder — Director's Cut", () => {
    const allFilenames = [
      "Movie (2020) {edition-DirectorsCut}.mkv",
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      "Movie (2020) {edition-Theatrical}.mkv",
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
    ]
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Movie (2020) {edition-DirectorsCut}.mkv",
        allFilenamesInFolder: allFilenames,
      }),
    ).toEqual([
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
    ])
  })

  test("scopes correctly across two editions in the same folder — Theatrical", () => {
    const allFilenames = [
      "Movie (2020) {edition-DirectorsCut}.mkv",
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      "Movie (2020) {edition-Theatrical}.mkv",
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
    ]
    expect(
      findSiblingsForEdition({
        mainFeatureFilename:
          "Movie (2020) {edition-Theatrical}.mkv",
        allFilenamesInFolder: allFilenames,
      }),
    ).toEqual([
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
    ])
  })

  test("does not include the main feature file itself in siblings", () => {
    const result = findSiblingsForEdition({
      mainFeatureFilename:
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      allFilenamesInFolder: [
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ],
    })
    expect(result).not.toContain(
      "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
    )
  })

  test("handles all Plex special-feature suffix types", () => {
    const base =
      "Dragon Lord (1982) {edition-Hong Kong Version}"
    expect(
      findSiblingsForEdition({
        mainFeatureFilename: `${base}.mkv`,
        allFilenamesInFolder: [
          `${base}.mkv`,
          `${base}-trailer.mkv`,
          `${base}-behindthescenes.mkv`,
          `${base}-deleted.mkv`,
          `${base}-featurette.mkv`,
          `${base}-interview.mkv`,
          `${base}-scene.mkv`,
          `${base}-short.mkv`,
          `${base}-other.mkv`,
        ],
      }),
    ).toEqual([
      `${base}-trailer.mkv`,
      `${base}-behindthescenes.mkv`,
      `${base}-deleted.mkv`,
      `${base}-featurette.mkv`,
      `${base}-interview.mkv`,
      `${base}-scene.mkv`,
      `${base}-short.mkv`,
      `${base}-other.mkv`,
    ])
  })
})
