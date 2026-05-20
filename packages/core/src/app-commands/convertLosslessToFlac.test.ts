import { join } from "node:path"
import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  Observable,
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
const { convertLosslessToFlac } = await import(
  "./convertLosslessToFlac.js"
)

const runFfmpegMock = vi.mocked(runFfmpeg)
const getMediaInfoMock = vi.mocked(getMediaInfo)

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

// Default per-test mediainfo mock: every probed file looks like
// 16-bit integer PCM (compatible). Tests that need float/DSD override
// with `mockMediaInfoOnce(...)`.
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
    runFfmpegMock.mockReset()
    getMediaInfoMock.mockReset()
    setDefaultPcmProbe()
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
      convertLosslessToFlac({
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

  test("invokes ffmpeg with -c:a flac and -map_metadata 0", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
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
      convertLosslessToFlac({
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
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music/album",
      }).pipe(toArray()),
    )

    const outputPaths = runFfmpegMock.mock.calls.map(
      ([{ outputFilePath }]) => outputFilePath,
    )
    expect(outputPaths).toEqual(
      expect.arrayContaining([
        join("/music/album", "track01.flac"),
        join("/music/album", "Track Two.flac"),
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
      convertLosslessToFlac({
        isRecursive: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths = runFfmpegMock.mock.calls.map(
      ([{ inputFilePaths }]) => inputFilePaths[0],
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
    mockFfmpegSuccess("/music/track01.flac")
    mockFfmpegSuccess("/music/disc1/inner.flac")
    mockFfmpegSuccess("/music/disc1/sub/deep.flac")
    mockFfmpegSuccess(
      "/music/disc1/sub/deeper/too-deep.flac",
    )

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: true,
        recursiveDepth: 2,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths = runFfmpegMock.mock.calls.map(
      ([{ inputFilePaths }]) => inputFilePaths[0],
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

  test("does not delete the source .wav when isSourceDeleted is omitted (default false)", async () => {
    vol.fromJSON({ "/music/track01.wav": "wav1" })
    mockFfmpegSuccess("/music/track01.flac")

    await firstValueFrom(
      convertLosslessToFlac({
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
      convertLosslessToFlac({
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
      convertLosslessToFlac({
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
      convertLosslessToFlac({
        isRecursive: false,
        isSourceDeleted: true,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/music/track01.wav")).toBe(true)
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
    mockFfmpegSuccess("/music/song.flac")
    mockFfmpegSuccess("/music/song.flac")
    mockFfmpegSuccess("/music/song.flac")
    mockFfmpegSuccess("/music/album.flac")
    mockFfmpegSuccess("/music/audiobook.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const inputPaths = runFfmpegMock.mock.calls.map(
      ([{ inputFilePaths }]) => inputFilePaths[0],
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

  test("output paths swap any accepted lossless extension to .flac in-place", async () => {
    vol.fromJSON({
      "/music/song.aif": "aif",
      "/music/album.m4a": "m4a",
    })
    mockFfmpegSuccess("/music/song.flac")
    mockFfmpegSuccess("/music/album.flac")

    await firstValueFrom(
      convertLosslessToFlac({
        isRecursive: false,
        sourcePath: "/music",
      }).pipe(toArray()),
    )

    const outputPaths = runFfmpegMock.mock.calls.map(
      ([{ outputFilePath }]) => outputFilePath,
    )
    expect(outputPaths).toEqual(
      expect.arrayContaining([
        join("/music", "song.flac"),
        join("/music", "album.flac"),
      ]),
    )
  })

  describe("result records", () => {
    test("emits a converted record for a single integer-PCM input (isSourceDeleted: false)", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })
      mockFfmpegSuccess(join("/music", "track01.flac"))

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

    test("emits a converted record with isSourceDeleted: true when the source was unlinked", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })
      mockFfmpegSuccess(join("/music", "track01.flac"))

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
      expect(runFfmpegMock).not.toHaveBeenCalled()
    })
  })

  describe("float / DSD probe skip", () => {
    test("emits a skipped record with reason: float-pcm when Format_Settings_Floating_Point is 'Yes', and does not invoke ffmpeg", async () => {
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
    })

    test("emits a skipped record with reason: dsd when Format is 'DSD', and does not invoke ffmpeg", async () => {
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
    })

    test("mixed batch: 1 integer-PCM + 1 float + 1 DSD → 1 converted + 2 skipped; ffmpeg called once", async () => {
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
      mockFfmpegSuccess(join("/music", "clean.flac"))

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
      expect(runFfmpegMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("isAuditOnly dry-run", () => {
    test("emits a skipped record with reason: audit-only for every otherwise-compatible input, and does not invoke ffmpeg", async () => {
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
    })

    test("does not unlink the source even when isSourceDeleted is true and isAuditOnly is true", async () => {
      vol.fromJSON({ "/music/track01.wav": "wav1" })

      await lastValueFrom(
        convertLosslessToFlac({
          isAuditOnly: true,
          isRecursive: false,
          isSourceDeleted: true,
          sourcePath: "/music",
        }),
      )

      expect(vol.existsSync("/music/track01.wav")).toBe(
        true,
      )
      expect(runFfmpegMock).not.toHaveBeenCalled()
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
    })
  })

  describe("float-pcm survival under destructive flags", () => {
    // Belt-and-suspenders contract: a 32-bit float WAV must NEVER be
    // encoded to FLAC and its source must NEVER be unlinked, regardless
    // of any other flag combination. This is the catastrophic-data-loss
    // case — float-PCM cannot be losslessly represented in FLAC, and
    // unlinking the source after a silent ffmpeg downcast would destroy
    // the only float copy the user has.
    test("isAuditOnly: false + isSourceDeleted: true + float WAV → no ffmpeg, no unlink, skipped record", async () => {
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
      expect(vol.existsSync("/music/float.wav")).toBe(true)
    })

    test("isAuditOnly: false + isSourceDeleted: true + Format_Profile: 'Float' (PcmWaveformat WAV, MediaInfo 26+) → no ffmpeg, no unlink", async () => {
      // The Clair Obscur OST shape: MediaInfo 26.01 emits
      // `Format_Profile: "Float"` and does NOT set
      // `Format_Settings_Floating_Point`. Probe must catch this and the
      // pipeline must refuse to convert/unlink — exactly the data-loss
      // scenario the worker 77 follow-up (commit 212661fe) addressed.
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
      expect(runFfmpegMock).not.toHaveBeenCalled()
      expect(
        vol.existsSync("/music/clair-obscur.wav"),
      ).toBe(true)
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
