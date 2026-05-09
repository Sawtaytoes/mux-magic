import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureLogMessage } from "./captureLogMessage.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { FileInfo } from "./getFiles.js"

describe(getFilesAtDepth.name, () => {
  beforeEach(() => {
    vol
    .fromJSON({
      "G:\\Demos\\Dolby\\[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}.mkv": "",
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv": "",
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv": "",
      "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv": "",
    })
  })

  test("errors if source path can't be found", async () => {
    captureLogMessage(
      "error",
      async () => {
        expect(
          firstValueFrom(
            getFilesAtDepth({
              depth: 0,
              sourcePath: "non-existent-path",
            })
          )
        )
        .rejects
        .toThrow(
          "ENOENT"
        )
      }
    )
  })

  test("emits no files when source only contains folders", async () => {
    await expect(
      firstValueFrom(
        getFilesAtDepth({
          depth: 0,
          sourcePath: "G:\\Movies",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([] satisfies (
      FileInfo[]
    ))
  })

  test("emits files when source contains files", async () => {
    await expect(
      firstValueFrom(
        getFilesAtDepth({
          depth: 0,
          sourcePath: "G:\\Movies\\Star Wars (1977)",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      {
        filename: "Star Wars (1977)",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv",
        renameFile: expect.any(Function),
      },
    ] satisfies (
      FileInfo[]
    ))
  })

  test("emits files when source contains files 1-level deep", async () => {
    await expect(
      firstValueFrom(
        getFilesAtDepth({
          depth: 1,
          sourcePath: "G:\\Movies",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      {
        filename: "Star Wars (1977)",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Super Mario Bros (1993)",
        fullPath: "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv",
        renameFile: expect.any(Function),
      },
    ] satisfies (
      FileInfo[]
    ))
  })

  test("emits files when source contains files 2-levels deep", async () => {
    await expect(
      firstValueFrom(
        getFilesAtDepth({
          depth: 2,
          sourcePath: "G:",
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      {
        filename: "[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}",
        fullPath: "G:\\Demos\\Dolby\\[Dolby] 747 (Audio) {FHD SDR & Dolby Atmos TrueHD}.mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977)",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Star Wars (1977) {edition-4K77}",
        fullPath: "G:\\Movies\\Star Wars (1977)\\Star Wars (1977) {edition-4K77}.mkv",
        renameFile: expect.any(Function),
      },
      {
        filename: "Super Mario Bros (1993)",
        fullPath: "G:\\Movies\\Super Mario Bros (1993)\\Super Mario Bros (1993).mkv",
        renameFile: expect.any(Function),
      },
    ] satisfies (
      FileInfo[]
    ))
  })
})
