import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import { moveFileToEditionFolder } from "./nameSpecialFeaturesDvdCompareTmdb.editions.js"
import { isMainFeatureFilename } from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"
import { findSiblingsForEdition } from "./nameSpecialFeaturesDvdCompareTmdb.findSiblingsForEdition.js"

describe("multi-edition release — integration", () => {
  beforeEach(() => {
    vol.reset()
  })

  test("two editions each get their own folder with the right files", async () => {
    const sourceFolder = "/work/source"
    const movie = { title: "Movie", year: "2020" }

    const allFilenames = [
      "Movie (2020) {edition-DirectorsCut}.mkv",
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      "Movie (2020) {edition-Theatrical}.mkv",
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
    ]

    // Seed the virtual filesystem
    const seedEntries = Object.fromEntries(
      allFilenames.map((filename) => [
        join(sourceFolder, filename),
        `content-of-${filename}`,
      ]),
    )
    vol.fromJSON(seedEntries)

    // Find main features and gather per-edition file lists
    const mainFeatures = allFilenames.filter((filename) =>
      isMainFeatureFilename(filename),
    )

    // For each main feature, move it + its siblings into the edition folder
    const allFilesToMove = mainFeatures.flatMap(
      (mainFilename) => {
        const siblings = findSiblingsForEdition({
          mainFeatureFilename: mainFilename,
          allFilenamesInFolder: allFilenames,
        })
        return [mainFilename].concat(siblings)
      },
    )

    // Execute moves sequentially (promises resolve in order)
    const movePromises = allFilesToMove.map((filename) =>
      lastValueFrom(
        moveFileToEditionFolder({
          sourceFilePath: join(sourceFolder, filename),
          movie,
        }),
      ),
    )
    const results = await Promise.all(movePromises)

    // All moves should succeed (no collisions)
    results.forEach((result) => {
      expect(result).toMatchObject({
        hasMovedToEditionFolder: true,
      })
    })

    // Verify Director's Cut folder has the right two files
    const directorsCutFolder = join(
      "/work",
      "Movie (2020)",
      "Movie (2020) {edition-DirectorsCut}",
    )
    const directorsCutFiles = await readdir(
      directorsCutFolder,
    )
    expect(directorsCutFiles.sort()).toEqual([
      "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      "Movie (2020) {edition-DirectorsCut}.mkv",
    ])

    // Verify Theatrical folder has the right two files
    const theatricalFolder = join(
      "/work",
      "Movie (2020)",
      "Movie (2020) {edition-Theatrical}",
    )
    const theatricalFiles = await readdir(theatricalFolder)
    expect(theatricalFiles.sort()).toEqual([
      "Movie (2020) {edition-Theatrical}-trailer.mkv",
      "Movie (2020) {edition-Theatrical}.mkv",
    ])

    // Verify source folder is empty (all files moved)
    const sourceFiles = await readdir(sourceFolder)
    expect(sourceFiles).toEqual([])
  })
})
