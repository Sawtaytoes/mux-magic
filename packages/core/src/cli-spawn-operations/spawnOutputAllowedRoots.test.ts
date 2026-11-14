import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { vol } from "memfs"
import {
  firstValueFrom,
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

import { PathSafetyError } from "../tools/pathSafety.js"

// The external tools write their output files themselves, outside core's
// guarded fs wrappers, so each spawn wrapper checks the output path
// before it starts the process. These tests run the real wrappers, so
// each one is unmocked here to override the auto-mock in vitest.setup.ts.
vi.unmock("./runMakeMkvConExtract.js")
vi.unmock("./runMkvExtract.js")
vi.unmock("./runMkvMerge.js")
vi.unmock("./runMkvPropEdit.js")
vi.unmock("./writeChaptersMkvMerge.js")

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  stdin = new PassThrough()
  pid: number | undefined = undefined
}

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => new FakeChildProcess()),
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

const { spawn } = await import("node:child_process")
const { runMakeMkvConExtract } = await import(
  "./runMakeMkvConExtract.js"
)
const { runMkvExtract } = await import("./runMkvExtract.js")
const { runMkvMerge } = await import("./runMkvMerge.js")
const { runMkvPropEdit } = await import(
  "./runMkvPropEdit.js"
)
const { writeChaptersMkvMerge } = await import(
  "./writeChaptersMkvMerge.js"
)

const originalAllowedFileRoots =
  process.env.ALLOWED_FILE_ROOTS

beforeEach(() => {
  process.env.ALLOWED_FILE_ROOTS = "/media"
  vi.mocked(spawn).mockClear()
  vi.spyOn(console, "info").mockImplementation(() => {})
  vol.fromJSON({ "/media/show/episode.mkv": "episode" })
})

// Most spawn wrappers log a failure and complete without output, so one
// bad file does not end the batch. A refused path takes the same route:
// nothing is spawned, nothing is emitted, and the refusal is logged.
const expectRefusedWithoutSpawn = async (
  observable: Observable<string>,
) => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {})

  await expect(
    lastValueFrom(observable.pipe(toArray())),
  ).resolves.toEqual([])

  expect(spawn).not.toHaveBeenCalled()
  expect(
    consoleErrorSpy.mock.calls
      .flat()
      .map((part: unknown) =>
        part instanceof Error ? part.message : String(part),
      )
      .join(" "),
  ).toContain("outside the allowed file roots")
}

afterEach(() => {
  if (originalAllowedFileRoots === undefined) {
    delete process.env.ALLOWED_FILE_ROOTS
  } else {
    process.env.ALLOWED_FILE_ROOTS =
      originalAllowedFileRoots
  }
})

describe("spawn wrappers check the output path before they start the tool", () => {
  test("runMkvMerge refuses an output outside the allowed roots", async () => {
    await expectRefusedWithoutSpawn(
      runMkvMerge({
        args: ["/media/show/episode.mkv"],
        outputFilePath: "/outside/episode.mkv",
      }),
    )
  })

  test("runMkvMerge starts the tool for an output inside the allowed roots", () => {
    const subscription = runMkvMerge({
      args: ["/media/show/episode.mkv"],
      outputFilePath: "/media/show/REMUXED/episode.mkv",
    }).subscribe({ error: () => {} })

    expect(spawn).toHaveBeenCalledTimes(1)
    subscription.unsubscribe()
  })

  test("runMkvMerge refuses a split when an existing part is a link that leads outside", async () => {
    vol.fromJSON({ "/outside/kept.mkv": "kept" })
    vol.mkdirSync("/media/show/SPLITS", { recursive: true })
    vol.symlinkSync(
      "/outside/kept.mkv",
      "/media/show/SPLITS/episode-001.mkv",
    )

    await expectRefusedWithoutSpawn(
      runMkvMerge({
        args: [
          "--split",
          "chapters:3",
          "/media/show/episode.mkv",
        ],
        outputFilePath: "/media/show/SPLITS/episode.mkv",
      }),
    )
  })

  test("runMkvExtract refuses when any output is outside the allowed roots", async () => {
    await expectRefusedWithoutSpawn(
      runMkvExtract({
        args: [],
        outputFilePaths: [
          "/media/show/track-1.ass",
          "/outside/track-2.ass",
        ],
      }),
    )
  })

  test("runMkvPropEdit refuses to edit a file outside the allowed roots", async () => {
    await expectRefusedWithoutSpawn(
      runMkvPropEdit({
        args: [],
        filePath: "/outside/episode.mkv",
      }),
    )
  })

  test("writeChaptersMkvMerge refuses an output outside the allowed roots", async () => {
    await expectRefusedWithoutSpawn(
      writeChaptersMkvMerge({
        chaptersXmlPath: "/media/show/chapters.xml",
        inputFilePath: "/media/show/episode.mkv",
        outputFilePath: "/outside/episode.mkv",
      }),
    )
  })

  test("runMakeMkvConExtract refuses a destination outside the allowed roots", async () => {
    await expect(
      firstValueFrom(
        runMakeMkvConExtract({
          destinationPath: "/outside",
          minimumTitleLengthSeconds: 0,
          outputFilePath: "/outside/title_t00.mkv",
          sourcePath: "/media/disc",
          titleIndex: 0,
        }),
      ),
    ).rejects.toBeInstanceOf(PathSafetyError)
    expect(spawn).not.toHaveBeenCalled()
  })
})
