import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { moveFiles } from "./moveFiles.js"

describe(moveFiles.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Work\\OUT\\episode-01.mkv": "ep1",
      "G:\\Work\\OUT\\episode-02.mkv": "ep2",
    })
  })

  test("emits one { source, destination } per file moved", async () => {
    const results = await firstValueFrom(
      moveFiles({
        sourcePath: "G:\\Work\\OUT",
        destinationPath: "G:\\Work",
      })
      .pipe(toArray()),
    )

    expect(results.sort((itemA, itemB) => itemA.source.localeCompare(itemB.source))).toEqual([
      { source: "G:\\Work\\OUT\\episode-01.mkv", destination: "G:\\Work\\episode-01.mkv" },
      { source: "G:\\Work\\OUT\\episode-02.mkv", destination: "G:\\Work\\episode-02.mkv" },
    ])
  })

  test("removes the source directory after every copy succeeds", async () => {
    await firstValueFrom(
      moveFiles({
        sourcePath: "G:\\Work\\OUT",
        destinationPath: "G:\\Work",
      })
      .pipe(toArray()),
    )

    await expect(stat("G:\\Work\\OUT")).rejects.toThrow()
    await expect(stat("G:\\Work\\episode-01.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Work\\episode-02.mkv")).resolves.toBeDefined()
  })
})
