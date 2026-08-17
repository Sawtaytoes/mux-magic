import { join } from "node:path"

import { vol } from "memfs"
import { firstValueFrom, of, throwError } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { runMakeMkvCon } from "../cli-spawn-operations/runMakeMkvCon.js"
import { runMakeMkvConExtract } from "../cli-spawn-operations/runMakeMkvConExtract.js"
import { parseTitleGraph } from "../tools/makemkv/parseTitleGraph.js"
import {
  extractDiscTitles,
  extractedTitlesFolderName,
} from "./extractDiscTitles.js"

const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "tools",
  "makemkv",
  "__fixtures__",
)
const loadGraph = (fixtureName: string) =>
  parseTitleGraph(
    realFs.readFileSync(
      join(FIXTURES_DIR, fixtureName),
      "utf8",
    ),
  )

const sourcePath = "/media/Disc-Rips/[BACKUP] Desk Set"
const extractedFolderPath = join(
  sourcePath,
  extractedTitlesFolderName,
)

// The spawn op is mocked, so "it ripped" means "makemkvcon was asked to
// rip, and the file it promised exists" — the app-command's own contract.
const mockSuccessfulExtraction = () => {
  vi.mocked(runMakeMkvConExtract).mockImplementation(
    ({ outputFilePath }) => {
      vol.mkdirSync(extractedFolderPath, {
        recursive: true,
      })
      vol.writeFileSync(outputFilePath, "mkv")

      return of(outputFilePath)
    },
  )
}

describe(extractDiscTitles.name, () => {
  // The setup file resets memfs between tests but not mock call history,
  // and "which title did it rip" is read off that history.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("rips every kept title into EXTRACTED-TITLES and leaves MakeMKV's filenames alone", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    mockSuccessfulExtraction()

    const extracted = await firstValueFrom(
      extractDiscTitles({
        minimumTitleLengthSeconds: 0,
        sourcePath,
      }),
    )

    expect(
      extracted.map((title) => title.filePath),
    ).toEqual(
      expect.arrayContaining([
        join(extractedFolderPath, "Desk Set_t00.mkv"),
      ]),
    )
    expect(
      extracted.every(
        (title) => title.isAlreadyExtracted === false,
      ),
    ).toBe(true)
  })

  test("passes the SAME minimum title length to the rip that the analysis used", async () => {
    // makemkvcon numbers titles AFTER applying --minlength, so an index
    // from a differently-filtered pass rips the wrong title.
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    mockSuccessfulExtraction()

    await firstValueFrom(
      extractDiscTitles({
        minimumTitleLengthSeconds: 60,
        sourcePath,
      }),
    )

    expect(runMakeMkvCon).toHaveBeenCalledWith({
      minimumTitleLengthSeconds: 60,
      sourcePath,
    })
    vi.mocked(runMakeMkvConExtract).mock.calls.forEach(
      ([call]) => {
        expect(call.minimumTitleLengthSeconds).toBe(60)
      },
    )
  })

  test("rips only the requested indexes when they are given", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    mockSuccessfulExtraction()

    const extracted = await firstValueFrom(
      extractDiscTitles({
        sourcePath,
        titleIndexes: [1],
      }),
    )

    expect(
      extracted.map((title) => title.titleIndex),
    ).toEqual([1])
  })

  test("skips a title whose file is already there instead of re-ripping it", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    mockSuccessfulExtraction()
    vol.mkdirSync(extractedFolderPath, { recursive: true })
    vol.writeFileSync(
      join(extractedFolderPath, "Desk Set_t01.mkv"),
      "already ripped",
    )

    const extracted = await firstValueFrom(
      extractDiscTitles({
        sourcePath,
        titleIndexes: [1],
      }),
    )

    expect(extracted[0]?.isAlreadyExtracted).toBe(true)
    expect(runMakeMkvConExtract).not.toHaveBeenCalled()
  })

  test("fails when makemkvcon claims success but wrote no file", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    vi.mocked(runMakeMkvConExtract).mockImplementation(
      ({ outputFilePath }) => of(outputFilePath),
    )

    await expect(
      firstValueFrom(
        extractDiscTitles({
          sourcePath,
          titleIndexes: [1],
        }),
      ),
    ).rejects.toThrow("does not exist")
  })

  test("propagates a rip failure rather than reporting an empty success", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )
    vi.mocked(runMakeMkvConExtract).mockReturnValue(
      throwError(
        () => new Error("makemkvcon saved 0 titles"),
      ),
    )

    await expect(
      firstValueFrom(
        extractDiscTitles({
          sourcePath,
          titleIndexes: [1],
        }),
      ),
    ).rejects.toThrow("saved 0 titles")
  })
})
