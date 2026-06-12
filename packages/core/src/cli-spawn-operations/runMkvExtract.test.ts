import { EventEmitter } from "node:events"
import { vol } from "memfs"
import { lastValueFrom, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  pid: number | undefined = undefined
}

const spawnRecords: FakeChildProcess[] = []

// This test exercises the real runMkvExtract implementation, so we
// unmock it here to override the global auto-mock from vitest.setup.ts.
// Lower-level dependencies (child_process, treeKillChild) are still
// mocked below to avoid actual process spawning.
vi.unmock("./runMkvExtract.js")

vi.mock("node:child_process", () => ({
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

vi.mock("../tools/createTtyAffordances.js", () => ({
  createTtyAffordances: () => ({
    isUsingTtyAffordances: false,
    detach: () => {},
  }),
}))

const { runMkvExtract } = await import("./runMkvExtract.js")

const driveProcess = ({
  exitCode,
}: {
  exitCode: number | null
}) =>
  new Promise<void>((resolve) => {
    setImmediate(() => {
      const latest = spawnRecords[spawnRecords.length - 1]
      if (exitCode === null) {
        latest.emit("close", null)
        // 'close' triggers the unlink path; give it a microtask to
        // resolve before we end the spawn.
        setImmediate(() => {
          latest.emit("exit", null)
          resolve()
        })
        return
      }
      latest.emit("exit", exitCode)
      resolve()
    })
  })

describe("runMkvExtract", () => {
  beforeEach(() => {
    spawnRecords.length = 0
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vol.fromJSON({
      "/work/EXTRACTED/episode/track0.eng.ass": "ass-bytes",
      "/work/EXTRACTED/episode/track1.jpn.srt": "srt-bytes",
    })
  })

  test("emits each outputFilePath in order on clean exit", async () => {
    const observable = runMkvExtract({
      args: [
        "tracks",
        "/work/episode.mkv",
        "0:/work/EXTRACTED/episode/track0.eng.ass",
        "1:/work/EXTRACTED/episode/track1.jpn.srt",
      ],
      outputFilePaths: [
        "/work/EXTRACTED/episode/track0.eng.ass",
        "/work/EXTRACTED/episode/track1.jpn.srt",
      ],
    })
    const resultPromise = lastValueFrom(
      observable.pipe(toArray()),
    )
    await driveProcess({ exitCode: 0 })

    await expect(resultPromise).resolves.toEqual([
      "/work/EXTRACTED/episode/track0.eng.ass",
      "/work/EXTRACTED/episode/track1.jpn.srt",
    ])
  })

  test("user-cancel (code=null) unlinks every output path", async () => {
    const observable = runMkvExtract({
      args: ["tracks", "/work/episode.mkv"],
      outputFilePaths: [
        "/work/EXTRACTED/episode/track0.eng.ass",
        "/work/EXTRACTED/episode/track1.jpn.srt",
      ],
    })
    const subscription = observable.subscribe({
      error: () => {},
    })
    await driveProcess({ exitCode: null })
    // Allow the chained .then() that follows Promise.all([unlink, …]) to run.
    await new Promise((resolve) => setImmediate(resolve))
    subscription.unsubscribe()

    expect(
      vol.existsSync(
        "/work/EXTRACTED/episode/track0.eng.ass",
      ),
    ).toBe(false)
    expect(
      vol.existsSync(
        "/work/EXTRACTED/episode/track1.jpn.srt",
      ),
    ).toBe(false)
  })

  test("user-cancel tolerates missing output paths (swallows ENOENT)", async () => {
    const observable = runMkvExtract({
      args: ["tracks", "/work/episode.mkv"],
      outputFilePaths: [
        "/work/EXTRACTED/episode/never-written.sup",
      ],
    })
    const subscription = observable.subscribe({
      error: () => {},
    })
    await expect(
      driveProcess({ exitCode: null }),
    ).resolves.toBeUndefined()
    subscription.unsubscribe()
  })
})
