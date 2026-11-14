import { readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { PathSafetyError } from "../tools/pathSafety.js"

import { deleteFilesByExtension } from "./deleteFilesByExtension.js"

describe(deleteFilesByExtension.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/anime-subtitles/episode.SRT": "",
      "/anime-subtitles/movie.ass": "",
      "/anime-subtitles/movie.srt": "",
      "/anime-subtitles/notes.txt": "",
      "/anime-subtitles/subtitles/extra.srt": "",
    })
  })

  test("deletes all files matching the requested extensions", async () => {
    const expected = [
      join("/anime-subtitles", "episode.SRT"),
      join("/anime-subtitles", "movie.srt"),
      join("/anime-subtitles", "subtitles", "extra.srt"),
    ]
    const actual = await firstValueFrom(
      deleteFilesByExtension({
        sourcePath: "/anime-subtitles",
        extensions: [".srt"],
        isRecursive: true,
        recursiveDepth: 2,
      }).pipe(toArray()),
    )
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)

    await expect(
      stat("/anime-subtitles/episode.SRT"),
    ).rejects.toThrow()
    await expect(
      stat("/anime-subtitles/movie.ass"),
    ).resolves.toBeDefined()
    await expect(
      stat("/anime-subtitles/movie.srt"),
    ).rejects.toThrow()
    await expect(
      stat("/anime-subtitles/notes.txt"),
    ).resolves.toBeDefined()
    await expect(
      stat("/anime-subtitles/subtitles/extra.srt"),
    ).rejects.toThrow()
  })

  describe("with ALLOWED_FILE_ROOTS set", () => {
    const originalAllowedFileRoots =
      process.env.ALLOWED_FILE_ROOTS

    beforeEach(() => {
      process.env.ALLOWED_FILE_ROOTS = "/anime-subtitles"
      vol.fromJSON({ "/outside/kept.srt": "kept" })
      vol.symlinkSync(
        "/outside",
        "/anime-subtitles/linked-folder",
      )
    })

    afterEach(() => {
      if (originalAllowedFileRoots === undefined) {
        delete process.env.ALLOWED_FILE_ROOTS
      } else {
        process.env.ALLOWED_FILE_ROOTS =
          originalAllowedFileRoots
      }
    })

    // The walk finds the file by descending through a folder link, so
    // the path is computed while the command runs.
    test("refuses a file reached through a folder link that leaves the root", async () => {
      await expect(
        firstValueFrom(
          deleteFilesByExtension({
            extensions: [".srt"],
            isRecursive: true,
            recursiveDepth: 2,
            sourcePath: "/anime-subtitles",
          }).pipe(toArray()),
        ),
      ).rejects.toBeInstanceOf(PathSafetyError)

      await expect(
        readFile("/outside/kept.srt", "utf8"),
      ).resolves.toBe("kept")
    })
  })
})
