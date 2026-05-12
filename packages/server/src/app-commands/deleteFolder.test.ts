import { stat } from "node:fs/promises"
import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  toArray,
} from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { deleteFolder } from "./deleteFolder.js"

describe(deleteFolder.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/TEMP/AUDIO-OFFSETS/offsets.json": "{}",
      "/work/TEMP/AUDIO-OFFSETS/nested/file.bin": "data",
      "/work/episode-01.mkv": "keep-me",
    })
  })

  test("recursively removes the folder when confirm is true", async () => {
    const result = await lastValueFrom(
      deleteFolder({
        confirm: true,
        folderPath: "/work/TEMP/AUDIO-OFFSETS",
      }),
    )

    expect(result).toBe("/work/TEMP/AUDIO-OFFSETS")
    await expect(
      stat("/work/TEMP/AUDIO-OFFSETS"),
    ).rejects.toThrow()
    await expect(
      stat("/work/TEMP/AUDIO-OFFSETS/nested/file.bin"),
    ).rejects.toThrow()
    // Sibling files outside the deleted folder survive.
    await expect(
      stat("/work/episode-01.mkv"),
    ).resolves.toBeDefined()
  })

  test("refuses to run and emits a propagated error when confirm is false", async () =>
    captureConsoleMessage("error", async () => {
      // logAndRethrow re-emits the thrown error so the runner can mark the
      // job as failed instead of silently no-opping. The destructive
      // command's refusal must be loud, not invisible.
      await expect(
        firstValueFrom(
          deleteFolder({
            confirm: false,
            folderPath: "/work/TEMP/AUDIO-OFFSETS",
          }).pipe(toArray()),
        ),
      ).rejects.toThrow(/confirm: true/i)

      // Folder must still be intact — confirm: false is a hard stop.
      await expect(
        stat("/work/TEMP/AUDIO-OFFSETS"),
      ).resolves.toBeDefined()
      await expect(
        stat("/work/TEMP/AUDIO-OFFSETS/offsets.json"),
      ).resolves.toBeDefined()
    }))

  test("logs the refusal reason when confirm is omitted from the call", async () =>
    captureConsoleMessage("error", async (consoleSpy) => {
      await expect(
        firstValueFrom(
          // @ts-expect-error — deliberately calling without confirm to exercise
          // the runtime guard that protects CLI / direct callers.
          deleteFolder({
            folderPath: "/work/TEMP/AUDIO-OFFSETS",
          }).pipe(toArray()),
        ),
      ).rejects.toThrow(/confirm: true/i)

      const errorOutput = consoleSpy.mock.calls
        .flat()
        .join(" ")
      expect(errorOutput).toMatch(/confirm: true/i)
      // Folder remains.
      await expect(
        stat("/work/TEMP/AUDIO-OFFSETS"),
      ).resolves.toBeDefined()
    }))
})
