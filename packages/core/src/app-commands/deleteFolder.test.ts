import { stat } from "node:fs/promises"
import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  toArray,
} from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { deleteFolder } from "./deleteFolder.js"

// Records which paths went to the trash and removes them from memfs, so
// a test can tell the trash strategy from a permanent delete.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push(paths.slice())
    paths.forEach((path) => {
      vol.rmSync(path, { recursive: true, force: true })
    })
    return Promise.resolve()
  }),
}))

describe(deleteFolder.name, () => {
  const originalDeleteMode = process.env.DELETE_MODE

  afterEach(() => {
    if (originalDeleteMode === undefined) {
      delete process.env.DELETE_MODE
    } else {
      process.env.DELETE_MODE = originalDeleteMode
    }
  })

  beforeEach(() => {
    vol.reset()
    trashCalls.splice(0)
    delete process.env.DELETE_MODE
    vol.fromJSON({
      "/work/TEMP/AUDIO-OFFSETS/offsets.json": "{}",
      "/work/TEMP/AUDIO-OFFSETS/nested/file.bin": "data",
      "/work/episode-01.mkv": "keep-me",
    })
  })

  test("recursively removes the folder when confirm is true", async () => {
    const result = await lastValueFrom(
      deleteFolder({
        isConfirmed: true,
        sourcePath: "/work/TEMP/AUDIO-OFFSETS",
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

  test("moves the folder to the trash by default", async () => {
    await lastValueFrom(
      deleteFolder({
        isConfirmed: true,
        sourcePath: "/work/TEMP/AUDIO-OFFSETS",
      }),
    )

    expect(trashCalls).toEqual([
      ["/work/TEMP/AUDIO-OFFSETS"],
    ])
  })

  test("deletes permanently when DELETE_MODE is permanent", async () => {
    process.env.DELETE_MODE = "permanent"

    await lastValueFrom(
      deleteFolder({
        isConfirmed: true,
        sourcePath: "/work/TEMP/AUDIO-OFFSETS",
      }),
    )

    expect(trashCalls).toEqual([])
    await expect(
      stat("/work/TEMP/AUDIO-OFFSETS"),
    ).rejects.toThrow()
  })

  test("refuses a relative path", async () =>
    captureConsoleMessage("error", async () => {
      await expect(
        lastValueFrom(
          deleteFolder({
            isConfirmed: true,
            sourcePath: "work/TEMP/AUDIO-OFFSETS",
          }),
        ),
      ).rejects.toThrow(/must be absolute/)

      expect(trashCalls).toEqual([])
      await expect(
        stat("/work/TEMP/AUDIO-OFFSETS"),
      ).resolves.toBeDefined()
    }))

  test("refuses to run and emits a propagated error when confirm is false", async () =>
    captureConsoleMessage("error", async () => {
      // logAndRethrowPipelineError re-emits the thrown error so the runner can mark the
      // job as failed instead of silently no-opping. The destructive
      // command's refusal must be loud, not invisible.
      await expect(
        firstValueFrom(
          deleteFolder({
            isConfirmed: false,
            sourcePath: "/work/TEMP/AUDIO-OFFSETS",
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
            sourcePath: "/work/TEMP/AUDIO-OFFSETS",
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
