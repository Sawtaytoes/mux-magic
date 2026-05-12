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

  test("errors when sourcePath contains no video files", async () => {
    await expect(
      firstValueFrom(
        keepLanguages({
          audioLanguages: ["jpn"],
          hasFirstAudioLanguage: false,
          hasFirstSubtitlesLanguage: false,
          isRecursive: false,
          sourcePath: "/work",
          subtitlesLanguages: ["eng"],
        }).pipe(toArray()),
      ),
    ).rejects.toThrow("No video files found")
  })

  test("errors when sourcePath does not exist", async () => {
    await expect(
      firstValueFrom(
        keepLanguages({
          audioLanguages: ["jpn"],
          hasFirstAudioLanguage: false,
          hasFirstSubtitlesLanguage: false,
          isRecursive: false,
          sourcePath: "/nonexistent",
          subtitlesLanguages: ["eng"],
        }).pipe(toArray()),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" })
  })
})
