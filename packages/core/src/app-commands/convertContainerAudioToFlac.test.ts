import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom, Observable, of } from "rxjs"
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

vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { convertContainerAudioFileToFlac } = await import(
  "../cli-spawn-operations/convertContainerAudioFileToFlac.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { convertContainerAudioToFlac } = await import(
  "./convertContainerAudioToFlac.js"
)

const convertContainerAudioFileToFlacMock = vi.mocked(
  convertContainerAudioFileToFlac,
)
const getMediaInfoMock = vi.mocked(getMediaInfo)

// convertContainerAudioFileToFlac emits the output file path once on
// success; on ffmpeg failure the stream completes without emitting
// (mirroring the real implementation).
const mockConvertSuccess = (outputFilePath: string) => {
  convertContainerAudioFileToFlacMock.mockReturnValueOnce(
    of(outputFilePath),
  )
}

const mockConvertFailure = () => {
  convertContainerAudioFileToFlacMock.mockReturnValueOnce(
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

const buildAudioTrack = (format = "FLAC"): AudioTrack =>
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
  convertContainerAudioFileToFlacMock.mockReset()
  getMediaInfoMock.mockReset()
  // Default: every file is audio-only FLAC-in-MKV
  getMediaInfoMock.mockImplementation(() =>
    of(buildAudioOnlyMediaInfo("FLAC")),
  )
})

describe("convertContainerAudioToFlac", () => {
  describe("spawn-op call shape", () => {
    test("invokes convertContainerAudioFileToFlac with the correct filePath", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: join("/music", "song.mkv"),
        }),
      )
    })

    test("invokes convertContainerAudioFileToFlac with the audioCodec from mediainfo", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildAudioOnlyMediaInfo("AAC")),
      )
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          audioCodec: "AAC",
        }),
      )
    })

    test("invokes convertContainerAudioFileToFlac with the FLAC codec when audio is already FLAC", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      // Default mock returns FLAC
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          audioCodec: "FLAC",
        }),
      )
    })

    test("passes isSourceDeleted: false by default", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ isSourceDeleted: false }),
      )
    })

    test("passes isSourceDeleted: true through to the spawn-op when requested", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ isSourceDeleted: true }),
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

      expect(
        convertContainerAudioFileToFlacMock,
      ).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    test("converts files with a video track when isVideoDropAcknowledged is true", async () => {
      vol.fromJSON({ "/music/video.mkv": "mkv" })
      getMediaInfoMock.mockImplementation(() =>
        of(buildAudioWithVideoMediaInfo("AAC")),
      )
      mockConvertSuccess("/music/video.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
    })

    test("skips files with no audio track and does not call the spawn-op", async () => {
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

      expect(
        convertContainerAudioFileToFlacMock,
      ).not.toHaveBeenCalled()
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
      mockConvertSuccess("/music/audio-only.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: false,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
      expect(result[0]?.source).toBe(
        join("/music", "audio-only.mkv"),
      )
    })
  })

  describe("isSourceDeleted", () => {
    test("does not delete the source file when isSourceDeleted is omitted (default false)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      // spawn-op returns output path; not deleting is handled by the
      // spawn-op implementation — at this level we just verify the
      // isSourceDeleted flag was forwarded correctly.
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ isSourceDeleted: false }),
      )
    })

    test("forwards isSourceDeleted: true to the spawn-op after a successful conversion", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ isSourceDeleted: true }),
      )
    })

    test("emits zero converted records when the spawn-op stream completes without emitting (ffmpeg failure path)", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertFailure()

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result).toHaveLength(0)
    })
  })

  describe("result records", () => {
    test("emits a converted record for a successful conversion", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess(join("/music", "song.flac"))

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

    test("emits a converted record with isSourceDeleted: true when requested", async () => {
      vol.fromJSON({ "/music/song.mkv": "mkv" })
      mockConvertSuccess(join("/music", "song.flac"))

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
      mockConvertSuccess("/music/song.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledTimes(1)
      const [{ filePath }] =
        convertContainerAudioFileToFlacMock.mock.calls[0]
      expect(filePath).toBe(join("/music", "song.mkv"))
    })

    test("descends one level into subdirectories when isRecursive is true", async () => {
      vol.fromJSON({
        "/music/song.mkv": "mkv",
        "/music/albums/inner.mkv": "mkv",
      })
      mockConvertSuccess("/music/song.flac")
      mockConvertSuccess("/music/albums/inner.flac")

      await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: true,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertContainerAudioFileToFlacMock,
      ).toHaveBeenCalledTimes(2)
      const inputPaths =
        convertContainerAudioFileToFlacMock.mock.calls.map(
          ([{ filePath }]) => filePath,
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
      mockConvertSuccess("/music/lossless-rip.flac")
      mockConvertSuccess("/music/aac-song.flac")

      const result = await lastValueFrom(
        convertContainerAudioToFlac({
          isRecursive: false,
          isVideoDropAcknowledged: true,
          sourcePath: "/music",
        }),
      )

      expect(result).toHaveLength(2)
      // lossless-rip uses FLAC codec (copy); aac-song uses AAC codec (re-encode)
      const losslessCall =
        convertContainerAudioFileToFlacMock.mock.calls.find(
          ([{ filePath }]) =>
            filePath.includes("lossless-rip"),
        )
      expect(losslessCall?.[0].audioCodec).toBe("FLAC")
      const aacCall =
        convertContainerAudioFileToFlacMock.mock.calls.find(
          ([{ filePath }]) => filePath.includes("aac-song"),
        )
      expect(aacCall?.[0].audioCodec).toBe("AAC")
    })
  })
})
