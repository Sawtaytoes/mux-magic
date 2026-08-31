import { vol } from "memfs"
import { lastValueFrom, of } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { runFfmpeg } from "./runFfmpeg.js"

const { convertSrtFileToAss } = await import(
  "./convertSrtFileToAss.js"
)

const runFfmpegMock = vi.mocked(runFfmpeg)

beforeEach(() => {
  vol.reset()
  runFfmpegMock.mockReset()
})

describe(convertSrtFileToAss.name, () => {
  test("uses ffmpeg's ASS subtitle encoder", async () => {
    const inputFilePath = "/subtitles/movie.srt"
    const outputFilePath =
      "/subtitles/CONVERTED-SUBTITLES/movie.ass"
    vol.fromJSON({ [inputFilePath]: "subtitle" })
    runFfmpegMock.mockReturnValue(of(outputFilePath))

    const result = await lastValueFrom(
      convertSrtFileToAss({
        inputFilePath,
        outputFilePath,
      }),
    )

    expect(runFfmpegMock).toHaveBeenCalledWith({
      args: ["-c:s", "ass"],
      inputFilePaths: [inputFilePath],
      outputFilePath,
    })
    expect(result).toBe(outputFilePath)
  })
})
