import { join } from "node:path"
import { describe, expect, test } from "vitest"
import {
  buildEditionPlan,
  type EditionPlanMove,
} from "./nameSpecialFeaturesDvdCompareTmdb.buildEditionPlan.js"

describe(buildEditionPlan.name, () => {
  test("produces a single move for a main-feature file with no siblings", () => {
    const result = buildEditionPlan({
      mainFeatureFilenames: [
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ],
      allFilenamesInFolder: [
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ],
      sourceFolder: "/work/source",
      destinationBaseFolder: "/work",
      movie: { title: "Dragon Lord", year: "1982" },
    })
    const expected: EditionPlanMove[] = [
      {
        sourceFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        destinationPath: join(
          "/work",
          "Dragon Lord (1982)",
          "Dragon Lord (1982) {edition-Hong Kong Version}",
          "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        ),
        editionName: "Hong Kong Version",
        isSibling: false,
      },
    ]
    expect(result).toEqual(expected)
  })

  test("includes sibling trailer in the edition plan with isSibling: true", () => {
    const result = buildEditionPlan({
      mainFeatureFilenames: [
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ],
      allFilenamesInFolder: [
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      ],
      sourceFolder: "/work/source",
      destinationBaseFolder: "/work",
      movie: { title: "Dragon Lord", year: "1982" },
    })
    expect(result).toHaveLength(2)
    const trailerMove = result.find((move) =>
      move.sourceFilename.endsWith("-trailer.mkv"),
    )
    expect(trailerMove).toEqual({
      sourceFilename:
        "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      destinationPath: join(
        "/work",
        "Dragon Lord (1982)",
        "Dragon Lord (1982) {edition-Hong Kong Version}",
        "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      ),
      editionName: "Hong Kong Version",
      isSibling: true,
    })
  })

  test("produces two edition groups for a multi-edition release", () => {
    const allFilenames = [
      "Movie (2020) {edition-DirectorsCut}.mkv",
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      "Movie (2020) {edition-Theatrical}.mkv",
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
    ]
    const result = buildEditionPlan({
      mainFeatureFilenames: [
        "Movie (2020) {edition-DirectorsCut}.mkv",
        "Movie (2020) {edition-Theatrical}.mkv",
      ],
      allFilenamesInFolder: allFilenames,
      sourceFolder: "/work/source",
      destinationBaseFolder: "/work",
      movie: { title: "Movie", year: "2020" },
    })
    expect(result).toHaveLength(4)
    const directorsCutMoves = result.filter(
      (move) => move.editionName === "DirectorsCut",
    )
    const theatricalMoves = result.filter(
      (move) => move.editionName === "Theatrical",
    )
    expect(directorsCutMoves).toHaveLength(2)
    expect(theatricalMoves).toHaveLength(2)
    expect(
      directorsCutMoves.find((move) => !move.isSibling)
        ?.sourceFilename,
    ).toBe("Movie (2020) {edition-DirectorsCut}.mkv")
    expect(
      directorsCutMoves.find((move) => move.isSibling)
        ?.sourceFilename,
    ).toBe(
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
    )
    expect(
      theatricalMoves.find((move) => !move.isSibling)
        ?.sourceFilename,
    ).toBe("Movie (2020) {edition-Theatrical}.mkv")
    expect(
      theatricalMoves.find((move) => move.isSibling)
        ?.sourceFilename,
    ).toBe("Movie (2020) {edition-Theatrical}-trailer.mkv")
  })

  test("skips files that have no edition tag", () => {
    const result = buildEditionPlan({
      mainFeatureFilenames: ["Dragon Lord (1982).mkv"],
      allFilenamesInFolder: ["Dragon Lord (1982).mkv"],
      sourceFolder: "/work/source",
      destinationBaseFolder: "/work",
      movie: { title: "Dragon Lord", year: "1982" },
    })
    expect(result).toEqual([])
  })
})
