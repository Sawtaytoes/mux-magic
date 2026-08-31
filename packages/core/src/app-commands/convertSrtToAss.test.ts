import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom, of } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

vi.mock(
  "../cli-spawn-operations/convertSrtFileToAss.js",
  () => ({ convertSrtFileToAss: vi.fn() }),
)

const { convertSrtFileToAss } = await import(
  "../cli-spawn-operations/convertSrtFileToAss.js"
)
const { convertSrtToAss } = await import(
  "./convertSrtToAss.js"
)

const convertSrtFileToAssMock = vi.mocked(
  convertSrtFileToAss,
)

beforeEach(() => {
  vol.reset()
  convertSrtFileToAssMock.mockReset()
  convertSrtFileToAssMock.mockImplementation(
    ({ outputFilePath }) => of(outputFilePath),
  )
})

describe(convertSrtToAss.name, () => {
  test("converts SRT files into a separate output folder", async () => {
    vol.fromJSON({
      "/subtitles/movie.srt":
        "1\n00:00:01,000 --> 00:00:02,000\nText",
      "/subtitles/notes.txt": "notes",
    })

    const results = await lastValueFrom(
      convertSrtToAss({
        isRecursive: false,
        sourcePath: "/subtitles",
      }),
    )

    const expectedOutputFilePath = join(
      "/subtitles",
      "CONVERTED-SUBTITLES",
      "movie.ass",
    )

    expect(convertSrtFileToAssMock).toHaveBeenCalledTimes(1)
    expect(convertSrtFileToAssMock).toHaveBeenCalledWith({
      inputFilePath: join("/subtitles", "movie.srt"),
      outputFilePath: expectedOutputFilePath,
    })
    expect(results).toEqual([expectedOutputFilePath])
  })

  test("preserves relative folders during recursive conversion", async () => {
    vol.fromJSON({
      "/subtitles/movie/english.srt": "subtitle",
    })

    const results = await lastValueFrom(
      convertSrtToAss({
        isRecursive: true,
        recursiveDepth: 2,
        sourcePath: "/subtitles",
      }),
    )

    expect(results).toEqual([
      join(
        "/subtitles",
        "CONVERTED-SUBTITLES",
        "movie",
        "english.ass",
      ),
    ])
  })

  test("matches uppercase SRT extensions", async () => {
    vol.fromJSON({
      "/subtitles/movie.SRT": "subtitle",
    })

    await lastValueFrom(
      convertSrtToAss({
        isRecursive: false,
        sourcePath: "/subtitles",
      }),
    )

    expect(convertSrtFileToAssMock).toHaveBeenCalledWith({
      inputFilePath: join("/subtitles", "movie.SRT"),
      outputFilePath: join(
        "/subtitles",
        "CONVERTED-SUBTITLES",
        "movie.ass",
      ),
    })
  })
})
