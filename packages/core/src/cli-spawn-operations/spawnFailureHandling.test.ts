import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import {
  lastValueFrom,
  type Observable,
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

import {
  MAKEMKV_INFO_TIMEOUT_MS,
  MEDIA_PROBE_TIMEOUT_MS,
} from "../tools/outboundTimeouts.js"

// Regression guard for the crash path: a child process that fails to
// spawn emits 'error'. With no listener, EventEmitter throws, the server's
// uncaughtException handler runs, and `process.exit(1)` ends every job.
// Each wrapper must turn that event into a failure of its own observable.
//
// These tests exercise the real spawn wrappers, so each one is unmocked
// here to override the global auto-mock from vitest.setup.ts.
vi.unmock("./runFfmpeg.js")
vi.unmock("./runMakeMkvCon.js")
vi.unmock("./runMkvExtract.js")
vi.unmock("./runMkvExtractStdOut.js")
vi.unmock("./runMkvMerge.js")
vi.unmock("./runMkvPropEdit.js")
vi.unmock("./runReadlineFfmpeg.js")
vi.unmock("./writeChaptersMkvMerge.js")

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  stdin = new PassThrough()
  pid: number | undefined = undefined
}

const spawnRecords: FakeChildProcess[] = []

const killTeardown = vi.fn()
const ttyDetach = vi.fn()

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => {
    const fakeProcess = new FakeChildProcess()
    spawnRecords.push(fakeProcess)
    return fakeProcess
  }),
}))

vi.mock("./treeKillChild.js", () => ({
  treeKillOnUnsubscribe: () => killTeardown,
}))

vi.mock("../api/logCapture.js", () => ({
  getActiveJobId: () => undefined,
}))

vi.mock("../tools/createTtyAffordances.js", () => ({
  createTtyAffordances: () => ({
    isUsingTtyAffordances: false,
    detach: ttyDetach,
  }),
}))

const { execFile } = await import("node:child_process")
const { runFfmpeg } = await import("./runFfmpeg.js")
const { runMakeMkvCon } = await import("./runMakeMkvCon.js")
const { runMkvExtract } = await import("./runMkvExtract.js")
const { runMkvExtractStdOut } = await import(
  "./runMkvExtractStdOut.js"
)
const { runMkvMerge } = await import("./runMkvMerge.js")
const { runMkvPropEdit } = await import(
  "./runMkvPropEdit.js"
)
const { runReadlineFfmpeg } = await import(
  "./runReadlineFfmpeg.js"
)
const { writeChaptersMkvMerge } = await import(
  "./writeChaptersMkvMerge.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { getMkvInfo } = await import(
  "../tools/getMkvInfo.js"
)

const buildSpawnError = () =>
  Object.assign(new Error("spawn missing-binary ENOENT"), {
    code: "ENOENT",
    syscall: "spawn missing-binary",
  })

const getLatestProcess = () => {
  const latest = spawnRecords.at(-1)
  if (latest === undefined) {
    throw new Error("Expected a spawned process.")
  }
  return latest
}

// A failed spawn emits 'error' and then 'close' with a negative errno.
// It never emits 'exit'.
const failSpawn = () => {
  const latest = getLatestProcess()
  latest.emit("error", buildSpawnError())
  latest.emit("close", -2, null)
}

const getLoggedText = (spy: {
  mock: { calls: unknown[][] }
}) =>
  spy.mock.calls
    .flat()
    .map((part: unknown) =>
      part instanceof Error ? part.message : String(part),
    )
    .join(" ")

const waitForMacrotask = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve)
  })

describe("spawn failures fail only their own observable", () => {
  beforeEach(() => {
    spawnRecords.length = 0
    killTeardown.mockClear()
    ttyDetach.mockClear()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const swallowingWrappers: Array<{
    name: string
    hasTtyAffordances: boolean
    start: () => Observable<unknown>
  }> = [
    {
      name: "runFfmpeg",
      hasTtyAffordances: false,
      start: () =>
        runFfmpeg({
          args: [],
          inputFilePaths: [],
          outputFilePath: "/work/out.mkv",
        }),
    },
    {
      name: "runMkvExtract",
      hasTtyAffordances: true,
      start: () =>
        runMkvExtract({
          args: [
            "tracks",
            "/work/in.mkv",
            "0:/work/out.ass",
          ],
          outputFilePaths: ["/work/out.ass"],
        }),
    },
    {
      name: "runMkvExtractStdOut",
      hasTtyAffordances: true,
      start: () =>
        runMkvExtractStdOut({
          args: ["chapters", "/work/in.mkv"],
        }),
    },
    {
      name: "runMkvMerge",
      hasTtyAffordances: true,
      start: () =>
        runMkvMerge({
          args: ["/work/in.mkv"],
          outputFilePath: "/work/out.mkv",
        }),
    },
    {
      name: "runMkvPropEdit",
      hasTtyAffordances: true,
      start: () =>
        runMkvPropEdit({
          args: ["--edit", "info"],
          filePath: "/work/in.mkv",
        }),
    },
    {
      name: "writeChaptersMkvMerge",
      hasTtyAffordances: true,
      start: () =>
        writeChaptersMkvMerge({
          chaptersXmlPath: "/work/chapters.xml",
          inputFilePath: "/work/in.mkv",
          outputFilePath: "/work/out.mkv",
        }),
    },
  ]

  swallowingWrappers.forEach(
    ({ hasTtyAffordances, name, start }) => {
      test(`${name} logs a spawn error and completes empty`, async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {})

        const resultPromise = lastValueFrom(
          start().pipe(toArray()),
        )
        await waitForMacrotask()

        expect(() => {
          failSpawn()
        }).not.toThrow()

        await expect(resultPromise).resolves.toEqual([])
        expect(getLoggedText(consoleErrorSpy)).toContain(
          "spawn missing-binary ENOENT",
        )
        // 'exit' never fires after a failed spawn, so the error path has
        // to restore the CLI terminal itself.
        expect(ttyDetach).toHaveBeenCalledTimes(
          hasTtyAffordances ? 1 : 0,
        )
      })
    },
  )

  test("runReadlineFfmpeg errors its observable on a spawn error", async () => {
    const resultPromise = lastValueFrom(
      runReadlineFfmpeg({
        args: ["-i", "/work/in.mkv"],
      }).pipe(toArray()),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => {
      failSpawn()
    }).not.toThrow()

    await expect(resultPromise).rejects.toThrow(
      "spawn missing-binary ENOENT",
    )
  })
})

describe("canceled runs whose output file was never written", () => {
  beforeEach(() => {
    spawnRecords.length = 0
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const cancelingWrappers: Array<{
    name: string
    start: () => Observable<unknown>
  }> = [
    {
      name: "runFfmpeg",
      start: () =>
        runFfmpeg({
          args: [],
          inputFilePaths: [],
          outputFilePath: "/never-written/out.mkv",
        }),
    },
    {
      name: "runMkvMerge",
      start: () =>
        runMkvMerge({
          args: ["/work/in.mkv"],
          outputFilePath: "/never-written/out.mkv",
        }),
    },
    {
      name: "writeChaptersMkvMerge",
      start: () =>
        writeChaptersMkvMerge({
          chaptersXmlPath: "/work/chapters.xml",
          inputFilePath: "/work/in.mkv",
          outputFilePath: "/never-written/out.mkv",
        }),
    },
  ]

  cancelingWrappers.forEach(({ name, start }) => {
    test(`${name} still reports the cancel when the unlink fails`, async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {})
      const unhandledRejections: unknown[] = []
      const recordRejection = (reason: unknown) => {
        unhandledRejections.push(reason)
      }
      process.on("unhandledRejection", recordRejection)

      const subscription = start().subscribe()
      await waitForMacrotask()
      getLatestProcess().emit("close", null)
      await waitForMacrotask()
      await waitForMacrotask()
      subscription.unsubscribe()
      process.off("unhandledRejection", recordRejection)

      expect(unhandledRejections).toEqual([])
      expect(getLoggedText(consoleWarnSpy)).toContain(
        "Process canceled by user.",
      )
    })
  })
})

describe("probe timeouts", () => {
  beforeEach(() => {
    spawnRecords.length = 0
    killTeardown.mockClear()
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("getMkvInfo fails and kills mkvmerge when the identify stalls", async () => {
    vi.useFakeTimers()
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const resultPromise = lastValueFrom(
      getMkvInfo("/work/stalled.mkv").pipe(toArray()),
    )

    await vi.advanceTimersByTimeAsync(
      MEDIA_PROBE_TIMEOUT_MS,
    )

    await expect(resultPromise).resolves.toEqual([])
    expect(getLoggedText(consoleErrorSpy)).toContain(
      `mkvmerge --identify timed out after ${MEDIA_PROBE_TIMEOUT_MS / 1000} seconds: /work/stalled.mkv`,
    )
    expect(killTeardown).toHaveBeenCalledTimes(1)
  })

  test("getMkvInfo does not time out a probe that finishes", async () => {
    vi.useFakeTimers()

    const resultPromise = lastValueFrom(
      getMkvInfo("/work/healthy.mkv").pipe(toArray()),
    )
    const latest = getLatestProcess()
    latest.stdout.write(
      JSON.stringify({
        container: { properties: {} },
        tracks: [],
      }),
    )
    latest.stdout.end()
    await vi.advanceTimersByTimeAsync(0)
    latest.emit("close", 0)

    await expect(resultPromise).resolves.toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  test("runMakeMkvCon fails the info scan when it stalls", async () => {
    vi.useFakeTimers()
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const resultPromise = lastValueFrom(
      runMakeMkvCon({ sourcePath: "/discs/stalled" }).pipe(
        toArray(),
      ),
    )

    await vi.advanceTimersByTimeAsync(
      MAKEMKV_INFO_TIMEOUT_MS,
    )

    await expect(resultPromise).resolves.toEqual([])
    expect(getLoggedText(consoleErrorSpy)).toContain(
      `makemkvcon info timed out after ${MAKEMKV_INFO_TIMEOUT_MS / 60000} minutes: /discs/stalled`,
    )
    expect(killTeardown).toHaveBeenCalledTimes(1)
  })

  test("getMediaInfo passes a timeout to execFile and names a timed-out probe", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      callback(
        Object.assign(new Error("Command failed"), {
          killed: true,
          signal: "SIGTERM",
        }),
      )
    }) as unknown as typeof execFile)

    await expect(
      lastValueFrom(
        getMediaInfo("/work/stalled.mkv").pipe(toArray()),
      ),
    ).resolves.toEqual([])

    expect(vi.mocked(execFile).mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        timeout: MEDIA_PROBE_TIMEOUT_MS,
      }),
    )
    expect(getLoggedText(consoleErrorSpy)).toContain(
      `mediainfo timed out after ${MEDIA_PROBE_TIMEOUT_MS / 1000} seconds: /work/stalled.mkv`,
    )
  })
})
