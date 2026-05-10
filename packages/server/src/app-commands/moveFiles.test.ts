import { stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { moveFiles } from "./moveFiles.js"

describe(moveFiles.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/OUT/episode-01.mkv": "ep1",
      "/work/OUT/episode-02.mkv": "ep2",
    })
  })

  test("emits one { source, destination } per file moved", async () => {
    const results = await firstValueFrom(
      moveFiles({
        sourcePath: "/work/OUT",
        destinationPath: "/work",
      }).pipe(toArray()),
    )

    expect(
      results.sort((itemA, itemB) =>
        itemA.source.localeCompare(itemB.source),
      ),
    ).toEqual([
      {
        source: join("/work/OUT", "episode-01.mkv"),
        destination: join("/work", "episode-01.mkv"),
      },
      {
        source: join("/work/OUT", "episode-02.mkv"),
        destination: join("/work", "episode-02.mkv"),
      },
    ])
  })

  test("removes the source directory after every copy succeeds", async () => {
    await firstValueFrom(
      moveFiles({
        sourcePath: "/work/OUT",
        destinationPath: "/work",
      }).pipe(toArray()),
    )

    await expect(stat("/work/OUT")).rejects.toThrow()
    await expect(
      stat("/work/episode-01.mkv"),
    ).resolves.toBeDefined()
    await expect(
      stat("/work/episode-02.mkv"),
    ).resolves.toBeDefined()
  })
})
