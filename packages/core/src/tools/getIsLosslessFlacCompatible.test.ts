import type { FileInfo } from "@mux-magic/tools"
import { firstValueFrom, of, throwError } from "rxjs"
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
} from "./getMediaInfo.js"

vi.mock("./getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { getMediaInfo } = await import("./getMediaInfo.js")
const { getIsLosslessFlacCompatible } = await import(
  "./getIsLosslessFlacCompatible.js"
)

const getMediaInfoMock = vi.mocked(getMediaInfo)

const buildMediaInfo = (
  audioOverrides: Partial<AudioTrack>,
): MediaInfo => {
  const audioTrack = {
    "@type": "Audio",
    BitDepth: "16",
    BitRate_Mode: "CBR",
    BitRate: "1411200",
    ChannelLayout_Original: "L R",
    ChannelLayout: "L R",
    ChannelPositions: "Front: L R",
    Channels_Original: "2",
    Channels: "2",
    CodecID: "1",
    Compression_Mode: "Lossless",
    Default: "Yes",
    Delay_Source: "Container",
    Delay: "0.000",
    Duration: "180.000",
    extra: {},
    Forced: "No",
    Format_Commercial: "PCM",
    Format: "PCM",
    FrameCount: "8467200",
    FrameRate: "44100.000",
    ID: "0",
    SamplesPerFrame: "1",
    SamplingCount: "7938000",
    SamplingRate: "44100",
    StreamOrder: "0",
    StreamSize: "31752000",
    UniqueID: "0",
    Video_Delay: "0",
    ...audioOverrides,
  } as AudioTrack
  const generalTrack = {
    "@type": "General",
  } as GeneralTrack
  return {
    creatingLibrary: {
      name: "MediaInfoLib",
      url: "https://mediaarea.net/MediaInfo",
      version: "23.04",
    },
    media: {
      "@ref": "/music/track.wav",
      track: [generalTrack, audioTrack],
    },
  }
}

const buildFileInfo = (fullPath: string): FileInfo => ({
  filename: fullPath.split("/").pop() ?? "",
  fullPath,
  renameFile: vi.fn(),
})

describe(getIsLosslessFlacCompatible.name, () => {
  beforeEach(() => {
    getMediaInfoMock.mockReset()
  })

  test("returns kind: compatible for integer PCM at 16-bit", async () => {
    getMediaInfoMock.mockReturnValue(
      of(buildMediaInfo({ BitDepth: "16" })),
    )
    const fileInfo = buildFileInfo("/music/track.wav")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({ fileInfo, kind: "compatible" })
  })

  test("returns kind: compatible for integer PCM at 24-bit", async () => {
    getMediaInfoMock.mockReturnValue(
      of(buildMediaInfo({ BitDepth: "24" })),
    )
    const fileInfo = buildFileInfo("/music/track.wav")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({ fileInfo, kind: "compatible" })
  })

  test("returns kind: compatible for integer PCM at 32-bit (Floating_Point: 'No')", async () => {
    getMediaInfoMock.mockReturnValue(
      of(
        buildMediaInfo({
          BitDepth: "32",
          Format_Settings_Floating_Point: "No",
        }),
      ),
    )
    const fileInfo = buildFileInfo("/music/track.wav")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({ fileInfo, kind: "compatible" })
  })

  test("returns kind: skip with reason: float-pcm when Format_Settings_Floating_Point is 'Yes' at 32-bit", async () => {
    getMediaInfoMock.mockReturnValue(
      of(
        buildMediaInfo({
          BitDepth: "32",
          Format_Settings_Floating_Point: "Yes",
        }),
      ),
    )
    const fileInfo = buildFileInfo("/music/float.wav")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({
      kind: "skip",
      reason: "float-pcm",
    })
  })

  test("returns kind: skip with reason: float-pcm when Format_Profile is 'Float' (PcmWaveformat WAVs, MediaInfo 26+)", async () => {
    // Regression: MediaInfo 26.01 emits `Format_Profile: "Float"` on
    // plain WAVE_FORMAT_IEEE_FLOAT files and does NOT set
    // Format_Settings_Floating_Point. Probe must accept either field.
    getMediaInfoMock.mockReturnValue(
      of(
        buildMediaInfo({
          BitDepth: "32",
          Format: "PCM",
          Format_Profile: "Float",
        }),
      ),
    )
    const fileInfo = buildFileInfo(
      "/music/float-pcmwaveformat.wav",
    )
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({
      kind: "skip",
      reason: "float-pcm",
    })
  })

  test("returns kind: skip with reason: float-pcm when Format_Settings_Floating_Point is 'Yes' at 64-bit", async () => {
    getMediaInfoMock.mockReturnValue(
      of(
        buildMediaInfo({
          BitDepth: "64",
          Format_Settings_Floating_Point: "Yes",
        }),
      ),
    )
    const fileInfo = buildFileInfo("/music/float64.wav")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({
      kind: "skip",
      reason: "float-pcm",
    })
  })

  test("returns kind: skip with reason: dsd when Format is 'DSD'", async () => {
    getMediaInfoMock.mockReturnValue(
      of(buildMediaInfo({ Format: "DSD" })),
    )
    const fileInfo = buildFileInfo("/music/track.dsf")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({ kind: "skip", reason: "dsd" })
  })

  test("returns kind: skip with reason: dsd when Format is 'DST' (DST-compressed DSD in DSDIFF)", async () => {
    // MediaInfo emits Format: "DST" for Direct Stream Transfer streams
    // inside .dff containers — a lossless compression of DSD that FLAC
    // also can't represent. `startsWith("DSD")` would miss it.
    getMediaInfoMock.mockReturnValue(
      of(buildMediaInfo({ Format: "DST" })),
    )
    const fileInfo = buildFileInfo("/music/track.dff")
    const result = await firstValueFrom(
      getIsLosslessFlacCompatible(fileInfo),
    )
    expect(result).toEqual({ kind: "skip", reason: "dsd" })
  })

  test("propagates errors from getMediaInfo instead of swallowing as a skip", async () => {
    const probeError = new Error("mediainfo crashed")
    getMediaInfoMock.mockReturnValue(
      throwError(() => probeError),
    )
    const fileInfo = buildFileInfo("/music/unreadable.wav")
    await expect(
      firstValueFrom(getIsLosslessFlacCompatible(fileInfo)),
    ).rejects.toBe(probeError)
  })
})
