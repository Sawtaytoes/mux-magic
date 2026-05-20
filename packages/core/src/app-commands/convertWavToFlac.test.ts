import { vol } from "memfs"
import { firstValueFrom, Observable, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

vi.mock("../cli-spawn-operations/runFfmpeg.js", () => ({
  runFfmpeg: vi.fn(),
}))

const { runFfmpeg } = await import(
  "../cli-spawn-operations/runFfmpeg.js"
)
const { convertWavToFlac } = await import(
  "./convertWavToFlac.js"
)

const runFfmpegMock = vi.mocked(runFfmpeg)

const mockFfmpegSuccess = (outputFilePath: string) => {
  runFfmpegMock.mockReturnValueOnce(of(outputFilePath))
}

// ffmpeg failure = subject completes without emitting, mirroring the
// `if (code === 0) observer.next(...)` guard inside runFfmpeg itself.
const mockFfmpegFailure = () => {
  runFfmpegMock.mockReturnValueOnce(
    new Observable<string>((subscriber) => {
      subscriber.complete()
    }),
  )
}

describe(convertWavToFlac.name, () => {
  beforeEach(() => {
    runFfmpegMock.mockReset()
  })

  test("encodes every .wav in the source directory (non-recursive)", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/track02.wav": "wav2",
      "/music/notes.mp3": "mp3",
      "/music/cover.jpg": "jpg",
      "/music/disc1/inner.wav": "innerwav",
    })
    mockFfmpegSuccess("/music/track01.flac")
    mockFfmpegSuccess("/music/track02.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(runFfmpegMock).toHaveBeenCalledTimes(2)
    const inputPaths = runFfmpegMock.mock.calls.map(
      ([{ inputFilePaths }]) => inputFilePaths[0],
    )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        "/music/track01.wav",
        "/music/track02.wav",
      ]),
    )
    expect(inputPaths).not.toContain("/music/notes.mp3")
    expect(inputPaths).not.toContain("/music/cover.jpg")
    expect(inputPaths).not.toContain("/music/disc1/inner.wav")
  })

  test("invokes ffmpeg with -c:a flac and -map_metadata 0", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const [{ args }] = runFfmpegMock.mock.calls[0]
    expect(args).toEqual(
      expect.arrayContaining(["-c:a", "flac"]),
    )
    expect(args).toEqual(
      expect.arrayContaining(["-map_metadata", "0"]),
    )
  })

  test("does not pass any resample / remix / bit-depth coercion flags (lossless guard)", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const [{ args }] = runFfmpegMock.mock.calls[0]
    expect(args).not.toContain("-ar")
    expect(args).not.toContain("-ac")
    expect(args).not.toContain("-sample_fmt")
  })

  test("writes the FLAC alongside the source WAV (same dir, .flac extension)", async () => {
    vol.fromJSON({
      "/music/album/track01.wav": "wav1",
      "/music/album/Track Two.wav": "wav2",
    })
    mockFfmpegSuccess("/music/album/track01.flac")
    mockFfmpegSuccess("/music/album/Track Two.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        sourcePath: "/music/album",
      }).pipe(toArray()),
    )

    const outputPaths = runFfmpegMock.mock.calls.map(
      ([{ outputFilePath }]) => outputFilePath,
    )
    expect(outputPaths).toEqual(
      expect.arrayContaining([
        "/music/album/track01.flac",
        "/music/album/Track Two.flac",
      ]),
    )
  })

  test("descends one level when isRecursive is true", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/disc1/inner.wav": "wav2",
    })
    mockFfmpegSuccess("/music/track01.flac")
    mockFfmpegSuccess("/music/disc1/inner.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths = runFfmpegMock.mock.calls.map(
      ([{ inputFilePaths }]) => inputFilePaths[0],
    )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        "/music/track01.wav",
        "/music/disc1/inner.wav",
      ]),
    )
  })

  test("does not delete the source .wav when isSourceDeleted is omitted (default false)", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/music/track01.wav")).toBe(true)
  })

  test("does not delete the source .wav when isSourceDeleted is false explicitly", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        isSourceDeleted: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/music/track01.wav")).toBe(true)
  })

  test("deletes the source .wav after a successful ffmpeg encode when isSourceDeleted is true", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/notes.mp3": "mp3",
    })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        isSourceDeleted: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/music/track01.wav")).toBe(false)
    // unrelated siblings are untouched
    expect(vol.existsSync("/music/notes.mp3")).toBe(true)
  })

  test("does NOT delete the source .wav when ffmpeg fails, even with isSourceDeleted: true", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegFailure()

    await firstValueFrom(
      convertWavToFlac({
        isRecursive: false,
        isSourceDeleted: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/music/track01.wav")).toBe(true)
  })
})
