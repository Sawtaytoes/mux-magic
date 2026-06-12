import type { FileInfo } from "@mux-magic/tools"
import { EMPTY } from "rxjs"
import { describe, expect, test } from "vitest"
import type {
  AudioTrack,
  GeneralTrack,
  MediaInfo,
  VideoTrack,
} from "./getMediaInfo.js"

const { getMediaTrackSummary } = await import(
  "./getMediaTrackSummary.js"
)

const buildGeneralTrack = (): GeneralTrack =>
  ({
    "@type": "General",
    AudioCount: "1",
    VideoCount: "0",
    Duration: "180.000",
  }) as GeneralTrack

const buildAudioTrack = (
  overrides: Partial<AudioTrack> = {},
): AudioTrack =>
  ({
    "@type": "Audio",
    Format: "FLAC",
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
    Format_Commercial: "FLAC",
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
    ...overrides,
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

const buildFileInfo = (fullPath: string): FileInfo => ({
  filename: fullPath.split("/").at(-1) ?? "",
  fullPath,
  renameFile: () => EMPTY,
})

const buildMediaInfo = (
  tracks: Array<AudioTrack | GeneralTrack | VideoTrack>,
): MediaInfo => ({
  creatingLibrary: {
    name: "MediaInfoLib",
    url: "https://mediaarea.net/MediaInfo",
    version: "23.04",
  },
  media: {
    "@ref": "/music/song.mkv",
    track: tracks,
  },
})

describe("getMediaTrackSummary", () => {
  test("returns audioTrackCount=1 and videoTrackCount=0 for audio-only MKV", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildAudioTrack(),
    ])
    const fileInfo = buildFileInfo("/music/song.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioTrackCount).toBe(1)
    expect(summary.videoTrackCount).toBe(0)
    expect(summary.hasVideoTrack).toBe(false)
  })

  test("returns hasVideoTrack=true when a Video track is present", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildVideoTrack(),
      buildAudioTrack(),
    ])
    const fileInfo = buildFileInfo("/music/video.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.hasVideoTrack).toBe(true)
    expect(summary.videoTrackCount).toBe(1)
  })

  test("extracts audioCodec from the first Audio track's Format field", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildAudioTrack({ Format: "FLAC" }),
    ])
    const fileInfo = buildFileInfo("/music/song.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioCodec).toBe("FLAC")
  })

  test("extracts AAC as audioCodec from AAC audio track", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildAudioTrack({ Format: "AAC" }),
    ])
    const fileInfo = buildFileInfo("/music/song.mp4")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioCodec).toBe("AAC")
  })

  test("returns audioCodec=null when there are no audio tracks", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildVideoTrack(),
    ])
    const fileInfo = buildFileInfo("/music/video-only.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioTrackCount).toBe(0)
    expect(summary.audioCodec).toBeNull()
  })

  test("counts multiple audio tracks correctly", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildAudioTrack({ Format: "AAC", ID: "1" }),
      buildAudioTrack({ Format: "FLAC", ID: "2" }),
    ])
    const fileInfo = buildFileInfo("/music/song.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioTrackCount).toBe(2)
    // First audio track wins for codec
    expect(summary.audioCodec).toBe("AAC")
  })

  test("returns all zeros and null codec for media with null media property", () => {
    const mediaInfo: MediaInfo = {
      creatingLibrary: {
        name: "MediaInfoLib",
        url: "https://mediaarea.net/MediaInfo",
        version: "23.04",
      },
      media: null,
    }
    const fileInfo = buildFileInfo("/music/empty.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioTrackCount).toBe(0)
    expect(summary.videoTrackCount).toBe(0)
    expect(summary.hasVideoTrack).toBe(false)
    expect(summary.audioCodec).toBeNull()
  })

  test("preserves the filePath from fileInfo on the summary", () => {
    const mediaInfo = buildMediaInfo([
      buildGeneralTrack(),
      buildAudioTrack(),
    ])
    const fileInfo = buildFileInfo("/music/song.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.filePath).toBe("/music/song.mkv")
  })

  test("empty track list (only general) returns audioTrackCount=0 and videoTrackCount=0", () => {
    const mediaInfo = buildMediaInfo([buildGeneralTrack()])
    const fileInfo = buildFileInfo("/music/empty.mkv")

    const summary = getMediaTrackSummary(
      fileInfo,
      mediaInfo,
    )

    expect(summary.audioTrackCount).toBe(0)
    expect(summary.videoTrackCount).toBe(0)
    expect(summary.hasVideoTrack).toBe(false)
    expect(summary.audioCodec).toBeNull()
  })
})
