import { stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

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
    await expect(
      firstValueFrom(
        deleteFilesByExtension({
          sourcePath: "/anime-subtitles",
          extensions: [".srt"],
          isRecursive: true,
          recursiveDepth: 2,
        }).pipe(toArray()),
      ),
    ).resolves.toEqual(
      expect.arrayContaining([
        join("/anime-subtitles", "episode.SRT"),
        join("/anime-subtitles", "movie.srt"),
        join("/anime-subtitles", "subtitles", "extra.srt"),
      ]),
    )

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
})
