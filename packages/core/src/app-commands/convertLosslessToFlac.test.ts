import { join } from "node:path"
import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  of,
  throwError,
  toArray,
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
} from "../tools/getMediaInfo.js"

vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))

const { convertLosslessFileToFlac } = await import(
  "../cli-spawn-operations/convertLosslessFileToFlac.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { convertLosslessToFlac } = await import(
  "./convertLosslessToFlac.js"
)

const convertLosslessFileToFlacMock = vi.mocked(
  convertLosslessFileToFlac,
)
const getMediaInfoMock = vi.mocked(getMediaInfo)

const mockConvertSuccess = (outputFilePath: string) => {
  convertLosslessFileToFlacMock.mockReturnValueOnce(
    of(outputFilePath),
  )
}

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
      "@ref": "/music",
      track: [generalTrack, audioTrack],
    },
  }
}

const setDefaultPcmProbe = () => {
  getMediaInfoMock.mockImplementation(() =>
    of(buildMediaInfo({})),
  )
}

const mockMediaInfoOnce = (
  pathSubstring: string,
  audioOverrides: Partial<AudioTrack>,
) => {
  const prevImpl = getMediaInfoMock.getMockImplementation()
  getMediaInfoMock.mockImplementation((filePath) => {
    if (filePath.includes(pathSubstring)) {
      return of(buildMediaInfo(audioOverrides))
    }
    return prevImpl?.(filePath) ?? of(buildMediaInfo({}))
  })
}

describe(convertLosslessToFlac.name, () => {
  beforeEach(() => {
    convertLosslessFileToFlacMock.mockReset()
    getMediaInfoMock.mockReset()
    setDefaultPcmProbe()
  })

  test("calls convertLosslessFileToFlac for every .wav in the source directory (non-recursive)", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/track02.wav": "wav2",
      "/music/notes.mp3": "mp3",
      "/music/cover.jpg": "jpg",
      "/music/disc1/inner.wav": "innerwav",
    })
    mockConvertSuccess("/music/track01.flac")
    mockConvertSuccess("/music/track02.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(
      convertLosslessFileToFlacMock,
    ).toHaveBeenCalledTimes(2)
    const inputPaths =
      convertLosslessFileToFlacMock.mock.calls.map(
        ([{ filePath }]) => filePath,
      )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        join("/music", "track01.wav"),
        join("/music", "track02.wav"),
      ]),
    )
    expect(inputPaths).not.toContain(
      join("/music", "notes.mp3"),
    )
    expect(inputPaths).not.toContain(
      join("/music", "cover.jpg"),
    )
    expect(inputPaths).not.toContain(
      join("/music", "disc1", "inner.wav"),
    )
  })

  test("calls convertLosslessFileToFlac with the correct filePath and default isSourceDeleted: false", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockConvertSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(
      convertLosslessFileToFlacMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: join("/music", "track01.wav"),
        isSourceDeleted: false,
      }),
    )
  })

  test("descends one level when isRecursive is true", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/disc1/inner.wav": "wav2",
    })
    mockConvertSuccess("/music/track01.flac")
    mockConvertSuccess("/music/disc1/inner.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths =
      convertLosslessFileToFlacMock.mock.calls.map(
        ([{ filePath }]) => filePath,
      )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        join("/music", "track01.wav"),
        join("/music", "disc1", "inner.wav"),
      ]),
    )
  })

  test("descends to recursiveDepth levels when isRecursive is true", async () => {
    vol.fromJSON({
      "/music/track01.wav": "wav1",
      "/music/disc1/inner.wav": "wav2",
      "/music/disc1/sub/deep.wav": "wav3",
      "/music/disc1/sub/deeper/too-deep.wav": "wav4",
    })
    mockConvertSuccess("/music/track01.flac")
    mockConvertSuccess("/music/disc1/inner.flac")
    mockConvertSuccess("/music/disc1/sub/deep.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: true,
        recursiveDepth: 2,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths =
      convertLosslessFileToFlacMock.mock.calls.map(
        ([{ filePath }]) => filePath,
      )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        join("/music", "track01.wav"),
        join("/music", "disc1", "inner.wav"),
        join("/music", "disc1", "sub", "deep.wav"),
      ]),
    )
    expect(inputPaths).not.toContain(
      join(
        "/music",
        "disc1",
        "sub",
        "deeper",
        "too-deep.wav",
      ),
    )
  })

  test("does not call convertLosslessFileToFlac when isSourceDeleted is omitted (default false)", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockConvertSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(
      convertLosslessFileToFlacMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ isSourceDeleted: false }),
    )
  })

  test("does not call convertLosslessFileToFlac when isSourceDeleted is false explicitly", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockConvertSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        isSourceDeleted: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(
      convertLosslessFileToFlacMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ isSourceDeleted: false }),
    )
  })

  test("passes isSourceDeleted: true through to the spawn-op when requested", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockConvertSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        isSourceDeleted: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(
      convertLosslessFileToFlacMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ isSourceDeleted: true }),
    )
  })

  test("accepts .wav, .aif, .aiff, .m4a, .m4b and rejects everything else (including .flac and .mkv/.mp4)", async () => {
    vol.fromJSON({
      "/music/song.wav": "wav",
      "/music/song.aif": "aif",
      "/music/song.aiff": "aiff",
      "/music/album.m4a": "m4a",
      "/music/audiobook.m4b": "m4b",
      // Skipped: already FLAC.
      "/music/already.flac": "flac",
      // Skipped: lossy.
      "/music/notes.mp3": "mp3",
      "/music/podcast.aac": "aac",
      // Skipped: container-with-video; the has-video-track safety
      // worker handles these separately.
      "/music/music-video.mkv": "mkv",
      "/music/clip.mp4": "mp4",
    })
    // Mock once per accepted file.
    mockConvertSuccess("/music/song.flac")
    mockConvertSuccess("/music/song.flac")
    mockConvertSuccess("/music/song.flac")
    mockConvertSuccess("/music/album.flac")
    mockConvertSuccess("/music/audiobook.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths =
      convertLosslessFileToFlacMock.mock.calls.map(
        ([{ filePath }]) => filePath,
      )
    expect(inputPaths).toEqual(
      expect.arrayContaining([
        join("/music", "song.wav"),
        join("/music", "song.aif"),
        join("/music", "song.aiff"),
        join("/music", "album.m4a"),
        join("/music", "audiobook.m4b"),
      ]),
    )
    expect(inputPaths).toHaveLength(5)
    expect(inputPaths).not.toContain(
      join("/music", "already.flac"),
    )
    expect(inputPaths).not.toContain(
      join("/music", "notes.mp3"),
    )
    expect(inputPaths).not.toContain(
      join("/music", "music-video.mkv"),
    )
    expect(inputPaths).not.toContain(
      join("/music", "clip.mp4"),
    )
  })

  describe("result records", () => {
    test("emits a converted record for a single integer-PCM input (isSourceDeleted: false)", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })
      mockConvertSuccess(join("/music", "track01.flac"))

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          destination: join("/music", "track01.flac"),
          isSourceDeleted: false,
          kind: "converted",
          source: join("/music", "track01.wav"),
        },
      ])
    })

    test("emits a converted record with isSourceDeleted: true when requested", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })
      mockConvertSuccess(join("/music", "track01.flac"))

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          isSourceDeleted: true,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          destination: join("/music", "track01.flac"),
          isSourceDeleted: true,
          kind: "converted",
          source: join("/music", "track01.wav"),
        },
      ])
    })

    test("emits zero records when no lossless audio files match (extension filter still gates)", async () => {
      vol.fromJSON({
        "/music/already.flac": "flac",
        "/music/notes.mp3": "mp3",
        "/music/music-video.mkv": "mkv",
      })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })
  })

  describe("float / DSD probe skip", () => {
    test("emits a skipped record with reason: float-pcm when Format_Settings_Floating_Point is 'Yes', and does not invoke the spawn-op", async () => {
      vol.fromJSON({ "/music/float.wav": "wav1" })
      mockMediaInfoOnce("float.wav", {
        BitDepth: "32",
        Format_Settings_Floating_Point: "Yes",
      })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          kind: "skipped",
          reason: "float-pcm",
          source: join("/music", "float.wav"),
        },
      ])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })

    test("emits a skipped record with reason: dsd when Format is 'DSD', and does not invoke the spawn-op", async () => {
      vol.fromJSON({ "/music/dsd-source.aif": "aif" })
      mockMediaInfoOnce("dsd-source.aif", { Format: "DSD" })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          kind: "skipped",
          reason: "dsd",
          source: join("/music", "dsd-source.aif"),
        },
      ])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })

    test("mixed batch: 1 integer-PCM + 1 float + 1 DSD → 1 converted + 2 skipped; spawn-op called once", async () => {
      vol.fromJSON({
        "/music/clean.wav": "wav",
        "/music/float.wav": "wav",
        "/music/dsd.aif": "aif",
      })
      mockMediaInfoOnce("float.wav", {
        BitDepth: "32",
        Format_Settings_Floating_Point: "Yes",
      })
      mockMediaInfoOnce("dsd.aif", { Format: "DSD" })
      mockConvertSuccess(join("/music", "clean.flac"))

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      const converted = records.filter(
        (record) => record.kind === "converted",
      )
      const skipped = records.filter(
        (record) => record.kind === "skipped",
      )

      expect(converted).toHaveLength(1)
      expect(converted[0]).toMatchObject({
        kind: "converted",
        source: join("/music", "clean.wav"),
        destination: join("/music", "clean.flac"),
      })
      expect(skipped).toHaveLength(2)
      expect(
        skipped.map((record) => record.reason).sort(),
      ).toEqual(["dsd", "float-pcm"])
      expect(
        convertLosslessFileToFlacMock,
      ).toHaveBeenCalledTimes(1)
    })
  })

  describe("isAuditOnly dry-run", () => {
    test("emits a skipped record with reason: audit-only for every otherwise-compatible input, and does not invoke the spawn-op", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: true,
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          kind: "skipped",
          reason: "audit-only",
          source: join("/music", "track01.wav"),
        },
      ])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })

    test("does not invoke the spawn-op even when isSourceDeleted is true and isAuditOnly is true", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })

      await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: true,
          isRecursive: false,
          isSourceDeleted: true,
          sourcePath: "/music",
        }),
      )

      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })

    test("float / DSD skips still take precedence over audit-only (reason reflects the actual incompatibility)", async () => {
      vol.fromJSON({
        "/music/float.wav": "wav",
        "/music/clean.wav": "wav",
      })
      mockMediaInfoOnce("float.wav", {
        BitDepth: "32",
        Format_Settings_Floating_Point: "Yes",
      })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: true,
          isRecursive: false,
          sourcePath: "/music",
        }),
      )

      const reasonBySource = Object.fromEntries(
        records
          .filter((record) => record.kind === "skipped")
          .map((record) => [record.source, record.reason]),
      )
      expect(
        reasonBySource[join("/music", "float.wav")],
      ).toBe("float-pcm")
      expect(
        reasonBySource[join("/music", "clean.wav")],
      ).toBe("audit-only")
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })
  })

  describe("float-pcm survival under destructive flags", () => {
    test("isAuditOnly: false + isSourceDeleted: true + float WAV → no spawn-op, skipped record", async () => {
      vol.fromJSON({ "/music/float.wav": "wav-float" })
      mockMediaInfoOnce("float.wav", {
        BitDepth: "32",
        Format_Settings_Floating_Point: "Yes",
      })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: false,
          isRecursive: false,
          isSourceDeleted: true,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          kind: "skipped",
          reason: "float-pcm",
          source: join("/music", "float.wav"),
        },
      ])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })

    test("isAuditOnly: false + isSourceDeleted: true + Format_Profile: 'Float' (PcmWaveformat WAV, MediaInfo 26+) → no spawn-op, skipped record", async () => {
      vol.fromJSON({ "/music/clair-obscur.wav": "wav" })
      mockMediaInfoOnce("clair-obscur.wav", {
        BitDepth: "32",
        Format: "PCM",
        Format_Profile: "Float",
      })

      const records = await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: false,
          isRecursive: false,
          isSourceDeleted: true,
          sourcePath: "/music",
        }),
      )

      expect(records).toEqual([
        {
          kind: "skipped",
          reason: "float-pcm",
          source: join("/music", "clair-obscur.wav"),
        },
      ])
      expect(
        convertLosslessFileToFlacMock,
      ).not.toHaveBeenCalled()
    })
  })

  describe("probe errors", () => {
    test("propagates getMediaInfo errors as pipeline errors (no silent unreadable skip)", async () => {
      vol.fromJSON({ "/music/unreadable.wav": "wav" })
      const probeError = new Error("mediainfo crashed")
      getMediaInfoMock.mockImplementation(() =>
        throwError(() => probeError),
      )

      await expect(
        lastValueFrom(
          convertLosslessToFlac({
            isRecursive: false,
            sourcePath: "/music",
          }),
        ),
      ).rejects.toBe(probeError)
    })
  })
})
