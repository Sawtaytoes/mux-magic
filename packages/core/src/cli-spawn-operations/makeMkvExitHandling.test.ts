import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import { PassThrough } from "node:stream"
import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { childProcessCloseGraceMilliseconds } from "./onChildProcessSettled.js"

// A makemkvcon that crashes must fail its job. Before this, a segfault
// (code null, signal SIGSEGV) was read as the unsubscribe path, so
// analyseDiscBackup never emitted, never errored, and the job stayed
// "running" until someone cancelled it. These tests run the real wrappers,
// so each one is unmocked here to override the auto-mock in vitest.setup.ts.
vi.unmock("./runMakeMkvCon.js")
vi.unmock("./runMakeMkvConExtract.js")

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  stdin = new PassThrough()
  pid: number | undefined = undefined
}

const spawnRecords: FakeChildProcess[] = []

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => {
    const fakeProcess = new FakeChildProcess()
    spawnRecords.push(fakeProcess)
    return fakeProcess
  }),
}))

vi.mock("./treeKillChild.js", () => ({
  treeKillOnUnsubscribe: () => () => {},
}))

vi.mock("../api/logCapture.js", () => ({
  getActiveJobId: () => undefined,
}))

vi.mock("../tools/appPaths.js", () => ({
  makeMkvConPath: "makemkvcon",
  makeMkvHomePath: "/makemkv-config",
}))

const { spawn } = await import("node:child_process")
const { runMakeMkvCon } = await import("./runMakeMkvCon.js")
const { runMakeMkvConExtract } = await import(
  "./runMakeMkvConExtract.js"
)

const getLatestProcess = () => {
  const latest = spawnRecords.at(-1)
  if (latest === undefined) {
    throw new Error("Expected a spawned process.")
  }
  return latest
}

const robotLinesBeforeTheCrash = [
  'MSG:1005,0,1,"MakeMKV v2.0.0 linux(x64-release) started","%1 started","MakeMKV v2.0.0 linux(x64-release)"',
  'MSG:3006,131072,1,"Opening files on harddrive at file:///media/Disc-Rips/[BACKUP] Disc","Opening files on harddrive at %1","file:///media/Disc-Rips/[BACKUP] Disc"',
  "",
].join("\n")

const startInfoScan = () =>
  firstValueFrom(
    runMakeMkvCon({
      sourcePath: "/media/Disc-Rips/[BACKUP] Disc",
    }),
  )

const startExtraction = () =>
  firstValueFrom(
    runMakeMkvConExtract({
      destinationPath: "/media/Disc-Rips/titles",
      minimumTitleLengthSeconds: 10,
      outputFilePath:
        "/media/Disc-Rips/titles/title_t00.mkv",
      sourcePath: "/media/Disc-Rips/[BACKUP] Disc",
      titleIndex: 0,
    }),
  )

beforeEach(() => {
  spawnRecords.length = 0
  vi.mocked(spawn).mockClear()
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  vol.fromJSON({
    "/makemkv-config/.MakeMKV/settings.conf":
      'app_Key = "T-placeholder-key"\n',
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("a makemkvcon crash fails its job", () => {
  test("runMakeMkvCon errors with the signal and the last message when makemkvcon segfaults", async () => {
    const resultPromise = startInfoScan()
    const latest = getLatestProcess()

    latest.stdout.end(robotLinesBeforeTheCrash)
    latest.stderr.end("Segmentation fault\n")
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
    latest.emit("exit", null, "SIGSEGV")
    latest.emit("close", null, "SIGSEGV")

    await expect(resultPromise).rejects.toThrow(
      "makemkvcon crashed with SIGSEGV. Last message: Opening files on harddrive at file:///media/Disc-Rips/[BACKUP] Disc stderr: Segmentation fault",
    )
  })

  test("runMakeMkvCon errors with the exit code when makemkvcon exits non-zero", async () => {
    const resultPromise = startInfoScan()
    const latest = getLatestProcess()

    latest.stdout.end()
    latest.emit("exit", 253, null)
    latest.emit("close", 253, null)

    await expect(resultPromise).rejects.toThrow(
      "makemkvcon exited with code 253.",
    )
  })

  test("runMakeMkvConExtract errors when makemkvcon segfaults mid-title", async () => {
    const resultPromise = startExtraction()
    const latest = getLatestProcess()

    latest.stdout.end(robotLinesBeforeTheCrash)
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
    latest.emit("exit", null, "SIGSEGV")
    latest.emit("close", null, "SIGSEGV")

    await expect(resultPromise).rejects.toThrow(
      "makemkvcon crashed with SIGSEGV. Last message: Opening files on harddrive",
    )
  })

  test("a helper process holding stdout open cannot hold the job open after makemkvcon dies", async () => {
    vi.useFakeTimers()
    const resultPromise = startInfoScan()
    const latest = getLatestProcess()

    // 'exit' with no 'close': a child of makemkvcon still has the pipe.
    latest.emit("exit", null, "SIGSEGV")
    const rejection = expect(resultPromise).rejects.toThrow(
      "makemkvcon crashed with SIGSEGV.",
    )
    await vi.advanceTimersByTimeAsync(
      childProcessCloseGraceMilliseconds,
    )

    await rejection
  })
})

describe("makemkvcon never phones home", () => {
  test("runMakeMkvCon turns off the update check before it spawns makemkvcon", async () => {
    vi.mocked(spawn).mockImplementationOnce((() => {
      expect(
        readFileSync(
          "/makemkv-config/.MakeMKV/settings.conf",
          "utf8",
        ),
      ).toBe(
        'app_Key = "T-placeholder-key"\napp_AutoSubmitEnabled = "0"\napp_UpdateEnable = "0"\n',
      )
      const fakeProcess = new FakeChildProcess()
      spawnRecords.push(fakeProcess)
      return fakeProcess
    }) as unknown as typeof spawn)

    const resultPromise = startInfoScan()
    const latest = getLatestProcess()
    latest.stdout.end()
    latest.emit("close", 0, null)

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({ titles: [] }),
    )
    expect(vi.mocked(spawn).mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          HOME: "/makemkv-config",
        }),
      }),
    )
  })

  test("runMakeMkvConExtract turns off the update check before it spawns makemkvcon", async () => {
    const resultPromise = startExtraction()
    const latest = getLatestProcess()

    expect(
      readFileSync(
        "/makemkv-config/.MakeMKV/settings.conf",
        "utf8",
      ),
    ).toContain('app_UpdateEnable = "0"')

    latest.stdout.end()
    latest.emit("close", 1, null)
    await expect(resultPromise).rejects.toThrow(
      "makemkvcon exited with code 1.",
    )
  })
})
