import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureLogMessage } from "./captureLogMessage.js"
import type { FileInfo } from "./getFiles.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

describe(getFilesAtDepth.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/demos/Dolby/[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}.mkv":
        "",
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv":
        "",
      "/movies/Super Mario Bros (1993)/Super Mario Bros (1993).mkv":
        "",
    })
  })

  test("errors if source path can't be found", async () => {
    captureLogMessage("error", async () => {
      expect(
        firstValueFrom(
          getFilesAtDepth({
            depth: 0,
            sourcePath: "non-existent-path",
          }),
        ),
      ).rejects.toThrow("ENOENT")
    })
  })

  test("emits no files when source only contains folders", async () => {
    await expect(
      firstValueFrom(
        getFilesAtDepth({
          depth: 0,
          sourcePath: "/movies",
        }).pipe(toArray()),
      ),
    ).resolves.toEqual([] satisfies FileInfo[])
  })

  test("emits files when source contains files", async () => {
    const expected: FileInfo[] = [
      {
        filename: "Star Wars (1977)",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977).mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977) {edition-4K77}.mkv",
        ),
        renameFile: expect.any(Function),
      },
    ]
    const actual = await firstValueFrom(
      getFilesAtDepth({
        depth: 0,
        sourcePath: "/movies/Star Wars (1977)",
      }).pipe(toArray()),
    )
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
  })

  test("emits files when source contains files 1-level deep", async () => {
    const expected: FileInfo[] = [
      {
        filename: "Star Wars (1977)",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977).mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977) {edition-4K77}.mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Super Mario Bros (1993)",
        fullPath: join(
          "/movies/Super Mario Bros (1993)",
          "Super Mario Bros (1993).mkv",
        ),
        renameFile: expect.any(Function),
      },
    ]
    const actual = await firstValueFrom(
      getFilesAtDepth({
        depth: 1,
        sourcePath: "/movies",
      }).pipe(toArray()),
    )
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
  })

  test("emits files when source contains files 2-levels deep", async () => {
    const expected: FileInfo[] = [
      {
        filename:
          "[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}",
        fullPath: join(
          "/demos/Dolby",
          "[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}.mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977)",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977).mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: join(
          "/movies/Star Wars (1977)",
          "Star Wars (1977) {edition-4K77}.mkv",
        ),
        renameFile: expect.any(Function),
      },
      {
        filename: "Super Mario Bros (1993)",
        fullPath: join(
          "/movies/Super Mario Bros (1993)",
          "Super Mario Bros (1993).mkv",
        ),
        renameFile: expect.any(Function),
      },
    ]
    const actual = await firstValueFrom(
      getFilesAtDepth({
        depth: 2,
        sourcePath: "/",
      }).pipe(toArray()),
    )
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
  })
})
