import { access } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import {
  findUniqueTargetPath,
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
      moveFileToEditionFolder(
        "/work/source/Dragon Lord (1982).mkv",
        { title: "Dragon Lord", year: "1982" },
      ),
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
      moveFileToEditionFolder(
        "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
        { title: "Dragon Lord", year: "1982" },
      ),
    )
    // Build the expected path with `join` so the assertion is portable
    // across platforms (Windows uses `\`, POSIX uses `/`).
    expect(result).toBe(
      join(
        "/work",
        "Dragon Lord (1982)",
        "Dragon Lord (1982) {edition-Hong Kong Version}",
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    )
    // Original location is now empty.
    await expect(
      access(
        "/work/source/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    ).rejects.toThrow()
    // Destination exists.
    await expect(
      access(result as string),
    ).resolves.toBeUndefined()
  })
})
