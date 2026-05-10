import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { keepLanguages } from "./keepLanguages.js"

describe(keepLanguages.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/readme.txt": "ignore me",
    })
  })

  test("creates the output folder up front, even when no files need trimming", async () => {
    // Source has no video files at all → the spawn-based per-file flow
    // never fires, but the output folder should still exist so a
    // downstream sequence step that links to it via { linkedTo,
    // output: 'folder' } doesn't ENOENT.
    await firstValueFrom(
      keepLanguages({
        audioLanguages: ["jpn"],
        hasFirstAudioLanguage: false,
        hasFirstSubtitlesLanguage: false,
        isRecursive: false,
        sourcePath: "/work",
        subtitlesLanguages: ["eng"],
      }).pipe(toArray()),
    )

    const folderStats = await stat("/work/LANGUAGE-TRIMMED")
    expect(folderStats.isDirectory()).toBe(true)
  })
})
