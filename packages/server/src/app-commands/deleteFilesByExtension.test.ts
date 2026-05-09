import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { deleteFilesByExtension } from "./deleteFilesByExtension.js"

describe(deleteFilesByExtension.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\AnimeSubtitles\\movie.srt": "",
      "G:\\AnimeSubtitles\\movie.ass": "",
      "G:\\AnimeSubtitles\\episode.SRT": "",
      "G:\\AnimeSubtitles\\notes.txt": "",
      "G:\\AnimeSubtitles\\subtitles\\extra.srt": "",
    })
  })

  test("deletes all files matching the requested extensions", async () => {
    await expect(
      firstValueFrom(
        deleteFilesByExtension({
          sourcePath: "G:\\AnimeSubtitles",
          extensions: [".srt"],
          isRecursive: true,
          recursiveDepth: 2,
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      "G:\\AnimeSubtitles\\movie.srt",
      "G:\\AnimeSubtitles\\episode.SRT",
      "G:\\AnimeSubtitles\\subtitles\\extra.srt",
    ])

    await expect(stat("G:\\AnimeSubtitles\\movie.srt")).rejects.toThrow()
    await expect(stat("G:\\AnimeSubtitles\\episode.SRT")).rejects.toThrow()
    await expect(stat("G:\\AnimeSubtitles\\subtitles\\extra.srt")).rejects.toThrow()
    await expect(stat("G:\\AnimeSubtitles\\movie.ass")).resolves.toBeDefined()
    await expect(stat("G:\\AnimeSubtitles\\notes.txt")).resolves.toBeDefined()
  })
})
