import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { reorderTracks } from "./reorderTracks.js"

describe(reorderTracks.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Work\\episode-01.mkv": "stream",
    })
  })

  test("returns EMPTY when every track-index array is empty (no-op fast path)", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        reorderTracks({
          audioTrackIndexes: [],
          isRecursive: false,
          sourcePath: "G:\\Work",
          subtitlesTrackIndexes: [],
          videoTrackIndexes: [],
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
    })
  ))

  test("returns EMPTY when track-index arrays are nullish (defensive)", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        reorderTracks({
          // @ts-expect-error — defensive: callers from JS / loose schemas
          // could ship undefined; verify the guard handles it without crashing.
          audioTrackIndexes: undefined,
          isRecursive: false,
          sourcePath: "G:\\Work",
          // @ts-expect-error
          subtitlesTrackIndexes: undefined,
          // @ts-expect-error
          videoTrackIndexes: undefined,
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
    })
  ))
})
