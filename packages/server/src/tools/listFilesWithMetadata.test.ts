import { vol } from "memfs"
import { beforeEach, describe, expect, test } from "vitest"

import { listFilesWithMetadata } from "./listFilesWithMetadata.js"

describe(listFilesWithMetadata.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/disc-rips/SOLDIER - 4K/SOLDIER_t01.mkv":
        "movie-content",
      "/disc-rips/SOLDIER - 4K/SOLDIER_t02.mkv": "trailer",
      "/disc-rips/SOLDIER - 4K/subdir/nested.mkv": "nested",
    })
  })

  test("returns every direct child entry with size + mtime + null duration by default", async () => {
    const result = await listFilesWithMetadata(
      "/disc-rips/SOLDIER - 4K",
    )
    expect(result.entries).toHaveLength(3)
    const byName = Object.fromEntries(
      result.entries.map((entry) => [entry.name, entry]),
    )
    expect(byName["SOLDIER_t01.mkv"].size).toBe(
      "movie-content".length,
    )
    expect(byName["SOLDIER_t01.mkv"].isFile).toBe(true)
    expect(byName["SOLDIER_t01.mkv"].duration).toBeNull()
    expect(byName.subdir.isDirectory).toBe(true)
    expect(byName.subdir.isFile).toBe(false)
  })

  test("sorts directories before files, then alphabetically (case-insensitive)", async () => {
    vol.fromJSON({
      "/work/Zfile.mkv": "z",
      "/work/afile.mkv": "a",
      "/work/subdir/inner": "x",
      "/work/Bdir/inner2": "y",
    })
    const result = await listFilesWithMetadata("/work")
    expect(
      result.entries.map((entry) => entry.name),
    ).toEqual([
      // Directories first, alphabetically (case-insensitive)
      "Bdir",
      "subdir",
      // Then files
      "afile.mkv",
      "Zfile.mkv",
    ])
  })

  test("rejects relative paths via the path-safety guard", async () => {
    await expect(
      listFilesWithMetadata("relative/dir"),
    ).rejects.toThrow(/must be absolute/)
  })

  test("rejects empty paths", async () => {
    await expect(listFilesWithMetadata("")).rejects.toThrow(
      /Path is required/,
    )
  })
})
