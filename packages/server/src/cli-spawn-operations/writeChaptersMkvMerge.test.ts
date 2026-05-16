import { EventEmitter } from "node:events"
import { firstValueFrom, lastValueFrom, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

type SpawnRecord = {
  args: string[]
  command: string
  process: FakeChildProcess
}

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  pid: number | undefined = undefined
}

const spawnRecords: SpawnRecord[] = []

vi.mock("node:child_process", () => ({
  spawn: vi.fn(
    (command: string, args: string[]) => {
      const fakeProcess = new FakeChildProcess()
      spawnRecords.push({
        args,
        command,
        process: fakeProcess,
      })
      return fakeProcess
    },
  ),
}))

const { writeChaptersMkvMerge } = await import(
  "./writeChaptersMkvMerge.js"
)

const driveProcess = ({
  exitCode,
  stderrChunks,
}: {
  exitCode: number
  stderrChunks?: ReadonlyArray<string>
}) => {
  // Drain the microtask queue so the Observable subscription has installed
  // its event listeners on the child process before we emit events.
  return new Promise<void>((resolve) => {
    setImmediate(() => {
      const latest = spawnRecords[spawnRecords.length - 1]
      ;(stderrChunks ?? []).forEach((chunk) => {
        latest.process.stderr.emit(
          "data",
          Buffer.from(chunk),
        )
      })
      latest.process.emit("exit", exitCode)
      resolve()
    })
  })
}

describe("writeChaptersMkvMerge", () => {
  beforeEach(() => {
    spawnRecords.length = 0
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  test("spawns mkvmerge with --chapters <xml> -o <output> <input> in that order", async () => {
    const observable = writeChaptersMkvMerge({
      chaptersXmlPath: "/tmp/chapters.xml",
      inputFilePath: "/media/input.mkv",
      outputFilePath: "/media/output.renumbered.mkv",
    })
    const subscription = observable.subscribe({
      error: () => {},
    })
    await driveProcess({ exitCode: 0 })
    subscription.unsubscribe()

    expect(spawnRecords.length).toBe(1)
    const recordedArgs = spawnRecords[0].args
    expect(recordedArgs).toEqual([
      "--chapters",
      "/tmp/chapters.xml",
      "-o",
      "/media/output.renumbered.mkv",
      "/media/input.mkv",
    ])
  })

  test("emits the outputFilePath and completes on clean exit", async () => {
    const observable = writeChaptersMkvMerge({
      chaptersXmlPath: "/tmp/chapters.xml",
      inputFilePath: "/media/input.mkv",
      outputFilePath: "/media/output.renumbered.mkv",
    })
    const resultPromise = firstValueFrom(observable)
    await driveProcess({ exitCode: 0 })

    await expect(resultPromise).resolves.toBe(
      "/media/output.renumbered.mkv",
    )
  })

  test("logs an error containing exit code + buffered stderr text on non-zero exit (matches runMkvMerge swallow behavior)", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const emissionsPromise = lastValueFrom(
      writeChaptersMkvMerge({
        chaptersXmlPath: "/tmp/chapters.xml",
        inputFilePath: "/media/input.mkv",
        outputFilePath: "/media/output.renumbered.mkv",
      }).pipe(toArray()),
    )
    await driveProcess({
      exitCode: 2,
      stderrChunks: [
        "mkvmerge error: ",
        "the source file is corrupt",
      ],
    })
    const emissions = await emissionsPromise

    // logAndSwallowPipelineError swallows the error into EMPTY — verify
    // the underlying Error (joined stderr included) was logged.
    expect(emissions).toEqual([])
    const loggedArgs = consoleErrorSpy.mock.calls.flat()
    const loggedError = loggedArgs.find(
      (argument) => argument instanceof Error,
    ) as Error | undefined
    expect(loggedError?.message).toMatch(
      /exited with code 2.*mkvmerge error: the source file is corrupt/,
    )

    consoleErrorSpy.mockRestore()
  })
})
