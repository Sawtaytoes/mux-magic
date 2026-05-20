import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { moveFilesIntoNamedFolders } from "./moveFilesIntoNamedFolders.js"

describe(moveFilesIntoNamedFolders.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("moves each file into a same-named subfolder, stripping the extension for the folder name", async () => {
    vol.fromJSON({
      "/src/Casper.mkv": "movie1",
      "/src/Hocus Pocus.mkv": "movie2",
    })

    const results = await firstValueFrom(
      moveFilesIntoNamedFolders({
        sourcePath: "/src",
      }).pipe(toArray()),
    )

    expect(
      results.sort((recordA, recordB) =>
        recordA.source.localeCompare(recordB.source),
      ),
    ).toEqual([
      {
        source: join("/src", "Casper.mkv"),
        destination: join("/src", "Casper", "Casper.mkv"),
      },
      {
        source: join("/src", "Hocus Pocus.mkv"),
        destination: join(
          "/src",
          "Hocus Pocus",
          "Hocus Pocus.mkv",
        ),
      },
    ])
    expect(vol.existsSync("/src/Casper/Casper.mkv")).toBe(
      true,
    )
    expect(
      vol.existsSync("/src/Hocus Pocus/Hocus Pocus.mkv"),
    ).toBe(true)
    expect(vol.existsSync("/src/Casper.mkv")).toBe(false)
    expect(vol.existsSync("/src/Hocus Pocus.mkv")).toBe(
      false,
    )
  })

  test("leaves pre-existing directories untouched", async () => {
    vol.fromJSON({
      "/src/Casper.mkv": "movie",
      "/src/ExistingDir/keep.txt": "kept",
    })

    await firstValueFrom(
      moveFilesIntoNamedFolders({
        sourcePath: "/src",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/src/Casper/Casper.mkv")).toBe(
      true,
    )
    expect(
      vol.existsSync("/src/ExistingDir/keep.txt"),
    ).toBe(true)
  })

  test("file with no extension produces a folder name equal to the full filename", async () => {
    vol.fromJSON({
      "/src/README": "readme",
    })

    const results = await firstValueFrom(
      moveFilesIntoNamedFolders({
        sourcePath: "/src",
      }).pipe(toArray()),
    )

    expect(results).toEqual([
      {
        source: join("/src", "README"),
        destination: join("/src", "README", "README"),
      },
    ])
    expect(vol.existsSync("/src/README/README")).toBe(true)
  })

  test("empty source dir emits nothing and does not crash", async () => {
    vol.mkdirSync("/empty", { recursive: true })

    const results = await firstValueFrom(
      moveFilesIntoNamedFolders({
        sourcePath: "/empty",
      }).pipe(toArray()),
    )

    expect(results).toEqual([])
  })
})
