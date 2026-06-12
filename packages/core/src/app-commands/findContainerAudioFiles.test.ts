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
import type {
  AudioTrack,
  GeneralTrack,
  MediaInfo,
  VideoTrack,
} from "../tools/getMediaInfo.js"

vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { findContainerAudioFiles } = await import(
  "./findContainerAudioFiles.js"
)

const getMediaInfoMock = vi.mocked(getMediaInfo)

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

const buildGeneralTrack = (): GeneralTrack =>
  ({
    "@type": "General",
    AudioCount: "1",
    VideoCount: "0",
    Duration: "180.000",
  }) as GeneralTrack

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
  format = "AAC",
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
      buildAudioTrack(format),
    ],
  },
})

beforeEach(() => {
  vol.reset()
  getMediaInfoMock.mockReset()
  getMediaInfoMock.mockImplementation(() =>
    of(buildAudioOnlyMediaInfo()),
  )
})

describe("findContainerAudioFiles", () => {
  test("returns summaries for all container-with-video files in directory", async () => {
    vol.fromJSON({
      "/music/song.mkv": "mkv",
      "/music/clip.mp4": "mp4",
      "/music/track.flac": "flac",
      "/music/track.wav": "wav",
    })

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    expect(result).toHaveLength(2)
    const filePaths = result.map(
      (record) => record.filePath,
    )
    expect(filePaths).toEqual(
      expect.arrayContaining([
        join("/music", "song.mkv"),
        join("/music", "clip.mp4"),
      ]),
    )
  })

  test("probes each file with MediaInfo and returns the track summary shape", async () => {
    vol.fromJSON({ "/music/song.mkv": "mkv" })

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    expect(result[0]).toMatchObject({
      filePath: join("/music", "song.mkv"),
      audioTrackCount: 1,
      videoTrackCount: 0,
      hasVideoTrack: false,
      audioCodec: "FLAC",
    })
  })

  test("reports hasVideoTrack=true when a video track is present", async () => {
    vol.fromJSON({ "/music/video.mkv": "mkv" })
    getMediaInfoMock.mockImplementation(() =>
      of(buildAudioWithVideoMediaInfo()),
    )

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    expect(result[0]?.hasVideoTrack).toBe(true)
    expect(result[0]?.videoTrackCount).toBe(1)
  })

  test("returns empty array when no container-with-video files are present", async () => {
    vol.fromJSON({
      "/music/track.flac": "flac",
      "/music/track.wav": "wav",
    })

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    expect(result).toEqual([])
    expect(getMediaInfoMock).not.toHaveBeenCalled()
  })

  test("does not descend into subdirectories when isRecursive is false", async () => {
    vol.fromJSON({
      "/music/song.mkv": "mkv",
      "/music/albums/inner.mkv": "mkv",
    })

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    const filePaths = result.map(
      (record) => record.filePath,
    )
    expect(filePaths).toContain(join("/music", "song.mkv"))
    expect(filePaths).not.toContain(
      join("/music", "albums", "inner.mkv"),
    )
  })

  test("descends one level into subdirectories when isRecursive is true", async () => {
    vol.fromJSON({
      "/music/song.mkv": "mkv",
      "/music/albums/inner.mkv": "mkv",
    })
    getMediaInfoMock.mockImplementation(() =>
      of(buildAudioOnlyMediaInfo()),
    )

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: true,
        sourcePath: "/music",
      }),
    )

    const filePaths = result.map(
      (record) => record.filePath,
    )
    expect(filePaths).toContain(join("/music", "song.mkv"))
    expect(filePaths).toContain(
      join("/music", "albums", "inner.mkv"),
    )
  })

  test("does not mutate the filesystem — no files are created or deleted", async () => {
    vol.fromJSON({ "/music/song.mkv": "mkv" })
    const before = Object.keys(vol.toJSON())

    await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    const after = Object.keys(vol.toJSON())
    expect(after).toEqual(before)
  })

  test("accepts all six container-with-video extensions", async () => {
    vol.fromJSON({
      "/music/a.mkv": "mkv",
      "/music/b.mp4": "mp4",
      "/music/c.m4v": "m4v",
      "/music/d.mov": "mov",
      "/music/e.webm": "webm",
      "/music/f.avi": "avi",
    })
    getMediaInfoMock.mockImplementation(() =>
      of(buildAudioOnlyMediaInfo()),
    )

    const result = await lastValueFrom(
      findContainerAudioFiles({
        isRecursive: false,
        sourcePath: "/music",
      }),
    )

    expect(result).toHaveLength(6)
  })
})
