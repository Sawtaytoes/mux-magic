import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// Same rationale as splitChapters.test.ts: every cli-spawn-operations/*
// module spawns a real mkvtoolnix binary, so vitest.setup.ts auto-mocks
// the whole folder. Import the already-mocked symbols directly.
const { trimTailMkvMerge } = await import(
  "../cli-spawn-operations/trimTailMkvMerge.js"
)
const { getMkvInfo } = await import(
  "../tools/getMkvInfo.js"
)
const { trimFileTail } = await import("./trimFileTail.js")

vi.mock("../tools/getMkvInfo.js", () => ({
  getMkvInfo: vi.fn(),
}))

const NANOSECONDS_PER_SECOND = 1_000_000_000
const trimmedFolderPath = join("/work", "TRIMMED")

const stubDurations = (
  durationsSeconds: ReadonlyArray<number>,
) => {
  durationsSeconds.forEach((durationSeconds) => {
    vi.mocked(getMkvInfo).mockReturnValueOnce(
      of({
        container: {
          properties: {
            duration:
              durationSeconds * NANOSECONDS_PER_SECOND,
          },
        },
      }) as unknown as ReturnType<typeof getMkvInfo>,
    )
  })
}

// mkvmerge never writes the --output path when --split is in play; a
// single `parts:-<end>` range lands as `<stem>-001.mkv` beside it.
const stubTrimWritingParts = (partCount: number) => {
  vi.mocked(trimTailMkvMerge).mockImplementation(() => {
    const outputFilePath = join(
      trimmedFolderPath,
      "episode.mkv",
    )
    vol.mkdirSync(trimmedFolderPath, { recursive: true })
    Array.from({ length: partCount }).forEach(
      (_unused, partIndex) => {
        vol.writeFileSync(
          join(
            trimmedFolderPath,
            `episode-00${partIndex + 1}.mkv`,
          ),
          "trimmed-part",
        )
      },
    )
    return of(outputFilePath)
  })
}

describe("trimFileTail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  test("renames the single split part back onto the original file name", async () => {
    vol.fromJSON({ "/work/episode.mkv": "source-mkv" })
    stubTrimWritingParts(1)
    stubDurations([1427.16, 1421.086])

    const results = await firstValueFrom(
      trimFileTail({
        endTime: "00:23:41.086",
        fileName: "episode.mkv",
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(
      vol.existsSync(
        join(trimmedFolderPath, "episode.mkv"),
      ),
    ).toBe(true)
    expect(
      vol.existsSync(
        join(trimmedFolderPath, "episode-001.mkv"),
      ),
    ).toBe(false)
    expect(results[0]).toMatchObject({
      actualDurationSeconds: 1421.086,
      filePath: join(trimmedFolderPath, "episode.mkv"),
      requestedEndTime: "00:23:41.086",
      sourceDurationSeconds: 1427.16,
    })
  })

  test("refuses to overwrite an output that already exists", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv",
      "/work/TRIMMED/episode.mkv": "already-trimmed",
    })
    stubTrimWritingParts(1)

    await expect(
      firstValueFrom(
        trimFileTail({
          endTime: "00:23:41.086",
          fileName: "episode.mkv",
          sourcePath: "/work",
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(/refuses to overwrite/)

    expect(trimTailMkvMerge).not.toHaveBeenCalled()
  })

  test("names the missing source rather than surfacing a bare errno", async () => {
    vol.fromJSON({ "/work/other.mkv": "source-mkv" })

    await expect(
      firstValueFrom(
        trimFileTail({
          endTime: "00:23:41.086",
          fileName: "episode.mkv",
          sourcePath: "/work",
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(/no such file.*episode\.mkv/)

    expect(trimTailMkvMerge).not.toHaveBeenCalled()
  })

  test("fails loudly when the range produced more than one part", async () => {
    vol.fromJSON({ "/work/episode.mkv": "source-mkv" })
    stubTrimWritingParts(2)
    stubDurations([1427.16])

    await expect(
      firstValueFrom(
        trimFileTail({
          endTime: "00:23:41.086",
          fileName: "episode.mkv",
          sourcePath: "/work",
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(/expected exactly one output part/)
  })
})
