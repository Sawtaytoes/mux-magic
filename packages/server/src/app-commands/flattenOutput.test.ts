import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { flattenOutput } from "./flattenOutput.js"

describe(flattenOutput.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Work\\SUBTITLED\\episode-01.mkv": "merged-1",
      "G:\\Work\\SUBTITLED\\episode-02.mkv": "merged-2",
      "G:\\Work\\episode-01.mkv": "original-1",
      "G:\\Work\\unrelated.txt": "keep-me",
    })
  })

  test("copies every file in sourcePath up one level into the parent directory", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "G:\\Work\\SUBTITLED" })
      .pipe(toArray()),
    )

    // Files now exist alongside their originals; same-named originals are
    // overwritten by the SUBTITLED copies.
    await expect(stat("G:\\Work\\episode-01.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Work\\episode-02.mkv")).resolves.toBeDefined()
    // Unrelated parent files are untouched.
    await expect(stat("G:\\Work\\unrelated.txt")).resolves.toBeDefined()
  })

  test("preserves the source folder by default so mid-sequence inspection is possible", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "G:\\Work\\SUBTITLED" })
      .pipe(toArray()),
    )

    await expect(stat("G:\\Work\\SUBTITLED")).resolves.toBeDefined()
    await expect(stat("G:\\Work\\SUBTITLED\\episode-01.mkv")).resolves.toBeDefined()
  })

  test("removes the source folder when deleteSourceFolder is true", async () => {
    await firstValueFrom(
      flattenOutput({ deleteSourceFolder: true, sourcePath: "G:\\Work\\SUBTITLED" })
      .pipe(toArray()),
    )

    // Files survived in the parent, the SUBTITLED folder is gone.
    await expect(stat("G:\\Work\\episode-01.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Work\\episode-02.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Work\\SUBTITLED")).rejects.toThrow()
  })

  test("overwrites a same-named file in the parent with the source copy", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "G:\\Work\\SUBTITLED" })
      .pipe(toArray()),
    )

    // Read via memfs's sync API for content comparison.
    const merged = vol.readFileSync("G:\\Work\\episode-01.mkv", "utf8")
    expect(merged).toBe("merged-1")
  })
})
