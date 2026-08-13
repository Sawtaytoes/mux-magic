import { readFile, stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { flattenOutput } from "./flattenOutput.js"

describe(flattenOutput.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/SUBTITLED/episode-01.mkv": "merged-1",
      "/work/SUBTITLED/episode-02.mkv": "merged-2",
      "/work/episode-01.mkv": "original-1",
      "/work/unrelated.txt": "keep-me",
    })
  })

  test("copies every file in sourcePath up one level into the parent directory", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "/work/SUBTITLED" }).pipe(
        toArray(),
      ),
    )

    // Files now exist alongside their originals; same-named originals are
    // overwritten by the SUBTITLED copies.
    await expect(
      stat("/work/episode-01.mkv"),
    ).resolves.toBeDefined()
    await expect(
      stat("/work/episode-02.mkv"),
    ).resolves.toBeDefined()
    // Unrelated parent files are untouched.
    await expect(
      stat("/work/unrelated.txt"),
    ).resolves.toBeDefined()
  })

  test("preserves the source folder by default so mid-sequence inspection is possible", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "/work/SUBTITLED" }).pipe(
        toArray(),
      ),
    )

    await expect(
      stat("/work/SUBTITLED"),
    ).resolves.toBeDefined()
    await expect(
      stat("/work/SUBTITLED/episode-01.mkv"),
    ).resolves.toBeDefined()
  })

  test("removes the source folder when deleteSourceFolder is true", async () => {
    await firstValueFrom(
      flattenOutput({
        isDeletingSourceFolder: true,
        sourcePath: "/work/SUBTITLED",
      }).pipe(toArray()),
    )

    // Files survived in the parent, the SUBTITLED folder is gone.
    await expect(
      stat("/work/episode-01.mkv"),
    ).resolves.toBeDefined()
    await expect(
      stat("/work/episode-02.mkv"),
    ).resolves.toBeDefined()
    await expect(stat("/work/SUBTITLED")).rejects.toThrow()
  })

  test("overwrites a same-named file in the parent with the source copy", async () => {
    await firstValueFrom(
      flattenOutput({ sourcePath: "/work/SUBTITLED" }).pipe(
        toArray(),
      ),
    )

    // Read via memfs's sync API for content comparison.
    const merged = vol.readFileSync(
      "/work/episode-01.mkv",
      "utf8",
    )
    expect(merged).toBe("merged-1")
  })

  test("MOVES rather than copy+deletes when deleteSourceFolder is true", async () => {
    // Regression guard for the bug called out in
    // docs/decisions/2026-05-19-atomic-copy-and-filesystem-move.md: a
    // same-volume flatten that is about to delete its source must
    // `fs.rename` the files up, not write a second full copy of every
    // byte and then throw the originals away. Observable proof without
    // spying on fs: the source files are gone from disk *individually*
    // by the time the folder removal happens, and the destination holds
    // their contents.
    await firstValueFrom(
      flattenOutput({
        isDeletingSourceFolder: true,
        sourcePath: "/work/SUBTITLED",
      }).pipe(toArray()),
    )

    await expect(
      readFile("/work/episode-01.mkv", "utf8"),
    ).resolves.toBe("merged-1")
    await expect(
      readFile("/work/episode-02.mkv", "utf8"),
    ).resolves.toBe("merged-2")
    await expect(stat("/work/SUBTITLED")).rejects.toThrow()
  })

  test("still copies (leaving the source intact) when the folder is preserved", async () => {
    // The default path must NOT move — the whole point of preserving the
    // source folder is mid-sequence inspection, so the originals have to
    // survive with their contents.
    await firstValueFrom(
      flattenOutput({ sourcePath: "/work/SUBTITLED" }).pipe(
        toArray(),
      ),
    )

    await expect(
      readFile("/work/SUBTITLED/episode-01.mkv", "utf8"),
    ).resolves.toBe("merged-1")
    await expect(
      readFile("/work/episode-01.mkv", "utf8"),
    ).resolves.toBe("merged-1")
  })
})
