import { stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { moveFiles } from "./moveFiles.js"

describe(moveFiles.name, () => {
  beforeEach(() => {
    vol.reset()
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

  describe("fileFilterRegex", () => {
    test("moves only files matching the regex, leaves others in source", async () => {
      vol.fromJSON({
        "/filter-src/ep01.mkv": "ep1",
        "/filter-src/ep02.mkv": "ep2",
        "/filter-src/notes.txt": "notes",
      })

      await firstValueFrom(
        moveFiles({
          sourcePath: "/filter-src",
          destinationPath: "/filter-dst",
          fileFilterRegex: "\\.mkv$",
        }).pipe(toArray()),
      )

      expect(vol.existsSync("/filter-dst/ep01.mkv")).toBe(
        true,
      )
      expect(vol.existsSync("/filter-dst/notes.txt")).toBe(
        false,
      )
    })
  })

  describe("renameRegex", () => {
    test("applies rename pattern to destination filename", async () => {
      vol.fromJSON({
        "/ren-src/[Group] Show - 01.mkv": "ep1",
      })

      const results = await firstValueFrom(
        moveFiles({
          sourcePath: "/ren-src",
          destinationPath: "/ren-dst",
          renameRegex: {
            pattern: "^\\[.*?\\] (.+)$",
            replacement: "$1",
          },
        }).pipe(toArray()),
      )

      expect(results[0].destination).toBe(
        join("/ren-dst", "Show - 01.mkv"),
      )
      expect(vol.existsSync("/ren-dst/Show - 01.mkv")).toBe(
        true,
      )
    })
  })
})
