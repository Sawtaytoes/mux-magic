import { access } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import {
  findUniqueTargetPath,
  type MoveToEditionFolderResult,
  moveFileToEditionFolder,
} from "./nameSpecialFeaturesDvdCompareTmdb.editions.js"

describe(findUniqueTargetPath.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("returns the desired path unchanged when nothing exists there", async () => {
    vol.fromJSON({ "/work/keep.mkv": "x" })
    const result = await findUniqueTargetPath(
      "/work/free.mkv",
    )
    expect(result).toBe("/work/free.mkv")
  })

  test("appends ' (2)' when the desired path is taken, preserving extension", async () => {
    vol.fromJSON({ "/work/Dragon Lord (1982).mkv": "x" })
    const result = await findUniqueTargetPath(
      "/work/Dragon Lord (1982).mkv",
    )
    expect(result).toBe("/work/Dragon Lord (1982) (2).mkv")
  })

  test("counts up past (2), (3) when those are taken too", async () => {
    vol.fromJSON({
      "/work/clip.mkv": "x",
      "/work/clip (2).mkv": "x",
      "/work/clip (3).mkv": "x",
    })
    const result = await findUniqueTargetPath(
      "/work/clip.mkv",
    )
    expect(result).toBe("/work/clip (4).mkv")
  })
})

describe(moveFileToEditionFolder.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("returns null when the filename has no {edition-…} tag (no move performed)", async () => {
    vol.fromJSON({
      "/work/source/Dragon Lord (1982).mkv": "x",
    })
    const result = await lastValueFrom(
      moveFileToEditionFolder({
        sourceFilePath:
          "/work/source/Dragon Lord (1982).mkv",
        movie: { title: "Dragon Lord", year: "1982" },
      }),
    )
    expect(result).toBeNull()
    // Original file is still there.
    await expect(
      access("/work/source/Dragon Lord (1982).mkv"),
    ).resolves.toBeUndefined()
  })

  test("moves a tagged file into <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>", async () => {
    vol.fromJSON({
      "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv":
        "x",
    })
    const result = await lastValueFrom(
      moveFileToEditionFolder({
        sourceFilePath:
          "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        movie: { title: "Dragon Lord", year: "1982" },
      }),
    )
    // Build the expected path with `join` so the assertion is portable
    // across platforms (Windows uses `\`, POSIX uses `/`).
    const expectedPath = join(
      "/work",
      "Dragon Lord (1982)",
      "Dragon Lord (1982) {edition-Hong Kong Version}",
      "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
    )
    expect(result).toEqual({
      hasMovedToEditionFolder: true,
      filename:
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      destinationPath: expectedPath,
    })
    // Original location is now empty.
    await expect(
      access(
        "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    ).rejects.toThrow()
    // Destination exists.
    await expect(
      access(expectedPath),
    ).resolves.toBeUndefined()
  })

  // Collision detection tests
  test("proceeds when destination folder exists but is empty", async () => {
    vol.fromJSON({
      "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv":
        "x",
      // Empty destination folder (memfs needs a file to represent a folder)
      "/work/Dragon Lord (1982)/Dragon Lord (1982) {edition-Hong Kong Version}/.keep":
        "",
    })
    const result = await lastValueFrom(
      moveFileToEditionFolder({
        sourceFilePath:
          "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        movie: { title: "Dragon Lord", year: "1982" },
      }),
    )
    // Should succeed — empty dir is OK
    expect(result).toMatchObject({
      hasMovedToEditionFolder: true,
    })
  })

  test("emits a collision event and skips move when destination has a same-name file", async () => {
    const mainFile =
      "Dragon Lord (1982) {edition-Hong Kong Version}.mkv"
    const editionFolder = join(
      "/work",
      "Dragon Lord (1982)",
      "Dragon Lord (1982) {edition-Hong Kong Version}",
    )
    const existingFilePath = join(editionFolder, mainFile)
    vol.fromJSON({
      [`/work/source/${mainFile}`]: "new-content",
      [existingFilePath]: "existing-content",
    })
    const results = await lastValueFrom(
      moveFileToEditionFolder({
        sourceFilePath: `/work/source/${mainFile}`,
        movie: { title: "Dragon Lord", year: "1982" },
      }).pipe(toArray()),
    )
    // Should emit a collision event, not a success
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      hasEditionFolderCollision: true,
      filename: mainFile,
      destinationPath: existingFilePath,
      existingPath: existingFilePath,
    })
    // Original file should still be at source (not moved)
    await expect(
      access(`/work/source/${mainFile}`),
    ).resolves.toBeUndefined()
  })

  test("proceeds when destination folder has different (non-colliding) files", async () => {
    const mainFile =
      "Dragon Lord (1982) {edition-Hong Kong Version}.mkv"
    const editionFolder = join(
      "/work",
      "Dragon Lord (1982)",
      "Dragon Lord (1982) {edition-Hong Kong Version}",
    )
    // Different file already in the destination — additive move
    const differentFile = join(
      editionFolder,
      "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
    )
    vol.fromJSON({
      [`/work/source/${mainFile}`]: "main-content",
      [differentFile]: "trailer-content",
    })
    const result = await lastValueFrom(
      moveFileToEditionFolder({
        sourceFilePath: `/work/source/${mainFile}`,
        movie: { title: "Dragon Lord", year: "1982" },
      }),
    )
    // Should succeed (additive, no same-name conflict)
    expect(result).toMatchObject({
      hasMovedToEditionFolder: true,
      filename: mainFile,
    })
  })
})

describe("moveFileToEditionFolder — type narrowing", () => {
  test("MoveToEditionFolderResult type is exported", () => {
    const moved: MoveToEditionFolderResult = {
      hasMovedToEditionFolder: true,
      filename: "test.mkv",
      destinationPath: "/dest/test.mkv",
    }
    expect(moved.hasMovedToEditionFolder).toBe(true)
    const collision: MoveToEditionFolderResult = {
      hasEditionFolderCollision: true,
      filename: "test.mkv",
      destinationPath: "/dest/test.mkv",
      existingPath: "/dest/test.mkv",
    }
    expect(collision.hasEditionFolderCollision).toBe(true)
  })
})
