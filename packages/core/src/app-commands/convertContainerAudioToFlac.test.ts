import { join } from "node:path"
import { vol } from "memfs"
import {
  lastValueFrom,
  Observable,
  of,
} from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type {
  AudioTrack,
  GeneralTrack,
  MediaInfo,
  VideoTrack,
} from "../tools/getMediaInfo.js"

vi.mock("../cli-spawn-operations/runFfmpeg.js", () => ({
  runFfmpeg: vi.fn(),
}))

vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { runFfmpeg } = await import(
  "../cli-spawn-operations/runFfmpeg.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { convertContainerAudioToFlac } = await import(
  "./convertContainerAudioToFlac.js"
)

const runFfmpegMock = vi.mocked(runFfmpeg)
const getMediaInfoMock = vi.mocked(getMediaInfo)

// runFfmpeg only emits when ffmpeg exits 0; on failure the stream
// completes without emitting (mirroring the real implementation).
const mockFfmpegSuccess = (outputFilePath: string) => {
  runFfmpegMock.mockReturnValueOnce(of(outputFilePath))
}

const mockFfmpegFailure = () => {
  runFfmpegMock.mockReturnValueOnce(
    new Observable<string>((subscriber) => {
      subscriber.complete()
    }),
  )
}

const buildGeneralTrack = (): GeneralTrack =>
  ({
    "@type": "General",
    AudioCount: "1",
    VideoCount: "0",
    Duration: "180.000",
  }) as GeneralTrack

const buildAudioTrack = (
  format = "FLAC",
): AudioTrack =>
  ({
    "@type": "Audio",
    Format: format,
    BitDepth: "16",
    BitRate_Mode: "VBR",
    BitRate: "1000000",
    ChannelLayout_Original: "L R",
    ChannelLayout: "L R",
    ChannelPositions: "Front: L R",
    Channels_Original: "2",
    Channels: "2",
    CodecID: "A_FLAC",
    Compression_Mode: "Lossless",
    Default: "Yes",
    Delay_Source: "Container",
    Delay: "0",
    Duration: "180.000",
    extra: {},
    Forced: "No",
    Format_Commercial: format,
    FrameCount: "8000000",
    FrameRate: "44100.000",
    ID: "1",
    SamplesPerFrame: "4096",
    SamplingCount: "7938000",
    SamplingRate: "44100",
    StreamOrder: "1",
    StreamSize: "22500000",
    UniqueID: "1",
    Video_Delay: "0",
  }) as AudioTrack

const buildVideoTrack = (): VideoTrack =>
  ({
    "@type": "Video",
    Format: "AVC",
    BitDepth: "8",
    BitRate: "5000000",
    BitRate_Mode: "CBR",
    ChromaSubsampling: "4:2:0",
    CodecID: "V_MPEG4/ISO/AVC",
    ColorSpace: "YUV",
    Default: "Yes",
    Delay: "0",
    Delay_Source: "Container",
    DisplayAspectRatio: "16:9",
    Duration: "180.000",
    Forced: "No",
    Format_Level: "4.1",
    Format_Profile: "High",
    FrameCount: "5400",
    FrameRate: "30.000",
    FrameRate_Den: "1",
    FrameRate_Mode: "CFR",
    FrameRate_Num: "30",
    Height: "1080",
    ID: "0",
    PixelAspectRatio: "1.000",
    Sampled_Height: "1080",
    Sampled_Width: "1920",
    StreamOrder: "0",
    StreamSize: "112500000",
    UniqueID: "0",
    Width: "1920",
  }) as VideoTrack

const buildAudioOnlyMediaInfo = (
  format = "FLAC",
): MediaInfo => ({
  creatingLibrary: {
    name: "MediaInfoLib",
    url: "https://mediaarea.net/MediaInfo",
    version: "23.04",
  },
  media: {
    "@ref": "/music/song.mkv",
    track: [buildGeneralTrack(), buildAudioTrack(format)],
  },
})

const buildAudioWithVideoMediaInfo = (
  audioFormat = "AAC",
): MediaInfo => ({
  creatingLibrary: {
    name: "MediaInfoLib",
    url: "https://mediaarea.net/MediaInfo",
    version: "23.04",
  },
  media: {
    "@ref": "/music/video.mkv",
    track: [
      buildGeneralTrack(),
      buildVideoTrack(),
      buildAudioTrack(audioFormat),
    ],
  },
})

const buildVideoOnlyMediaInfo = (): MediaInfo => ({
  creatingLibrary: {
    name: "MediaInfoLib",
    url: "https://mediaarea.net/MediaInfo",
    version: "23.04",
  },
  media: {
    "@ref": "/music/video-only.mkv",
    track: [buildGeneralTrack(), buildVideoTrack()],
  },
})

beforeEach(() => {
  vol.reset()
  runFfmpegMock.mockReset()
  getMediaInfoMock.mockReset()
  // Default: every file is audio-only FLAC-in-MKV
  getMediaInfoMock.mockImplementation(() =>
    of(buildAudioOnlyMediaInfo("FLAC")),
  )
})

describe("convertContainerAudioToFlac", () => {
  describe("ffmpeg arg shape — lossless guard", () => {
    test("invokes ffmpeg with -vn (no video) flag", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).toContain("-vn")
    })

    test("invokes ffmpeg with -c:a flac when audio codec is not already FLAC", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildAudioOnlyMediaInfo("AAC")),
      )
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).toEqual(
        expect.arrayContaining(["-c:a", "flac"]),
      )
    })

    test("invokes ffmpeg with -c:a copy (lossless demux) when audio is already FLAC", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      // Default mock returns FLAC
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).toEqual(
        expect.arrayContaining(["-c:a", "copy"]),
      )
    })

    test("invokes ffmpeg with -map_metadata 0", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).toEqual(
        expect.arrayContaining(["-map_metadata", "0"]),
      )
    })

    test("does not pass -ar (lossless guard — no resample)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).not.toContain("-ar")
    })

    test("does not pass -ac (lossless guard — no remix)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).not.toContain("-ac")
    })

    test("does not pass -sample_fmt (lossless guard — no bit-depth coercion)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ args }] = runFfmpegMock.mock.calls[0]
      expect(args).not.toContain("-sample_fmt")
    })
  })

  describe("output path", () => {
    test("writes the FLAC in-place (same dir, .flac extension)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      const [{ outputFilePath }] =
        runFfmpegMock.mock.calls[0]
      expect(outputFilePath).toBe(
        join("/music", "song.flac"),
      )
    })
  })

  describe("video-track safety gate", () => {
    test("skips files with a video track when isVideoDropAcknowledged is false (default)", async () => {
      vol.fromJSON({ "/music/video.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildAudioWithVideoMediaInfo()),
      )

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    test("converts files with a video track when isVideoDropAcknowledged is true", async () => {
      vol.fromJSON({ "/music/video.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildAudioWithVideoMediaInfo("AAC")),
      )
      mockFfmpegSuccess("/music/video.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
    })

    test("skips files with no audio track and does not call ffmpeg", async () => {
      vol.fromJSON({ "/music/video-only.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildVideoOnlyMediaInfo()),
      )

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    test("mixed batch: audio-only converted, video+audio skipped when not acknowledged", async () => {
      vol.fromJSON({
        "/music/audio-only.mkv": "mkv",
        "/music/video-and-audio.mkv": "mkv",
      })
      getMediaInfoMock.mockImplementation((filePath) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("video-and-audio")
        ) {
          return of(buildAudioWithVideoMediaInfo())
        }
        return of(buildAudioOnlyMediaInfo())
      })
      mockFfmpegSuccess("/music/audio-only.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: false,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
      expect(result[0]?.source).toBe(
        join("/music", "audio-only.mkv"),
      )
    })
  })

  describe("isSourceDeleted", () => {
    test("does not delete the source file when isSourceDeleted is omitted (default false)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(vol.existsSync("/music/song.mkv")).toBe(true)
    })

    test("deletes the source file after a successful encode when isSourceDeleted is true", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(vol.existsSync("/music/song.mkv")).toBe(false)
    })

    test("does NOT delete the source when ffmpeg fails, even with isSourceDeleted: true", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegFailure()

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(vol.existsSync("/music/song.mkv")).toBe(true)
    })
  })

  describe("result records", () => {
    test("emits a converted record for a successful conversion", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess(join("/music", "song.flac"))

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result).toEqual([
        {
          kind: "converted",
          source: join("/music", "song.mkv"),
          destination: join("/music", "song.flac"),
          isSourceDeleted: false,
        },
      ])
    })

    test("emits a converted record with isSourceDeleted: true when source was unlinked", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockFfmpegSuccess(join("/music", "song.flac"))

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result[0]).toMatchObject({
        kind: "converted",
        isSourceDeleted: true,
      })
    })

    test("emits zero records when all files are skipped due to no audio track", async () => {
      vol.fromJSON({ "/music/video-only.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildVideoOnlyMediaInfo()),
      )

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result).toEqual([])
    })
  })

  describe("recursion", () => {
    test("does not descend into subdirectories when isRecursive is false", async () => {
      vol.fromJSON({
        "/music/song.mkv": "mkv",
        "/music/albums/inner.mkv": "mkv",
      })
      mockFfmpegSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).toHaveBeenCalledTimes(1)
      const [{ inputFilePaths }] =
        runFfmpegMock.mock.calls[0]
      expect(inputFilePaths[0]).toBe(
        join("/music", "song.mkv"),
      )
    })

    test("descends one level into subdirectories when isRecursive is true", async () => {
      vol.fromJSON({
        "/music/song.mkv": "mkv",
        "/music/albums/inner.mkv": "mkv",
      })
      mockFfmpegSuccess("/music/song.flac")
      mockFfmpegSuccess("/music/albums/inner.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(runFfmpegMock).toHaveBeenCalledTimes(2)
      const inputPaths = runFfmpegMock.mock.calls.map(
        ([{ inputFilePaths }]) => inputFilePaths[0],
      )
      expect(inputPaths).toEqual(
        expect.arrayContaining([
          join("/music", "song.mkv"),
          join("/music", "albums", "inner.mkv"),
        ]),
      )
    })
  })

  describe("parity fixture round-trip", () => {
    test("handles a directory with both FLAC-in-MKV (copy) and AAC-in-MP4 (re-encode)", async () => {
      vol.fromJSON({
        "/music/lossless-rip.mkv": "mkv",
        "/music/aac-song.mp4": "mp4",
      })
      getMediaInfoMock.mockImplementation((filePath) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("aac-song")
        ) {
          return of(buildAudioOnlyMediaInfo("AAC"))
        }
        return of(buildAudioOnlyMediaInfo("FLAC"))
      })
      mockFfmpegSuccess("/music/lossless-rip.flac")
      mockFfmpegSuccess("/music/aac-song.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result).toHaveLength(2)
      // lossless-rip uses copy (demux)
      const losslessCall = runFfmpegMock.mock.calls.find(
        ([{ inputFilePaths }]) =>
          inputFilePaths[0]?.includes("lossless-rip"),
      )
      expect(losslessCall?.[0].args).toContain("copy")
      // aac-song uses re-encode
      const aacCall = runFfmpegMock.mock.calls.find(
        ([{ inputFilePaths }]) =>
          inputFilePaths[0]?.includes("aac-song"),
      )
      expect(aacCall?.[0].args).toContain("flac")
    })
  })
})
