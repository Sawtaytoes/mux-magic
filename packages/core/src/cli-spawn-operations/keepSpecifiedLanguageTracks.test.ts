import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type {
  MkvInfo,
  MkvTookNixTrackType,
  Track,
} from "../tools/getMkvInfo.js"
import { LANGUAGE_TRIMMED_FOLDER_NAME } from "../tools/outputFolderNames.js"

// Exercise the REAL keepSpecifiedLanguageTracks (the global auto-mock in
// vitest.setup.ts would otherwise replace it). runMkvMerge stays mocked (it
// spawns mkvmerge); getMkvInfo is mocked below so the test controls the probed
// track layout.
vi.unmock("./keepSpecifiedLanguageTracks.js")

vi.mock("../tools/getMkvInfo.js", () => ({
  getMkvInfo: vi.fn(),
}))

const { keepSpecifiedLanguageTracks } = await import(
  "./keepSpecifiedLanguageTracks.js"
)
const { getMkvInfo } = await import(
  "../tools/getMkvInfo.js"
)
const { runMkvMerge } = await import("./runMkvMerge.js")

const makeTrack = (
  type: MkvTookNixTrackType,
  language: string,
  index: number,
): Track =>
  ({
    codec: type === "audio" ? "AC-3" : "PGS",
    id: index,
    properties: {
      codec_id: type === "audio" ? "A_AC3" : "S_HDMV/PGS",
      codec_private_length: 0,
      isDefaultTrack: index === 0,
      isEnabledTrack: true,
      isForcedTrack: false,
      language,
      num_index_entries: 0,
      number: index + 1,
      uid: index + 1,
    },
    type,
  }) as unknown as Track

const makeMkvInfo = ({
  audio,
  subtitles = [],
}: {
  audio: string[]
  subtitles?: string[]
}): MkvInfo =>
  ({
    attachments: [],
    chapters: [],
    container: {},
    errors: [],
    file_name: "/work/clip.mkv",
    global_tags: [],
    identification_format_version: 12,
    track_tags: [],
    tracks: [
      { type: "video" as const, lang: "und" },
      ...audio.map((language) => ({
        type: "audio" as const,
        lang: language,
      })),
      ...subtitles.map((language) => ({
        type: "subtitles" as const,
        lang: language,
      })),
    ].map(({ type, lang }, index) =>
      makeTrack(type, lang, index),
    ),
    warnings: [],
  }) as unknown as MkvInfo

const SOURCE = "/work/clip.mkv"
const OUTPUT = `/work/${LANGUAGE_TRIMMED_FOLDER_NAME}/clip.mkv`

const mkvMergeArgs = () =>
  vi.mocked(runMkvMerge).mock.calls[0]?.[0]?.args ?? []

const mockProbes = (source: MkvInfo, output: MkvInfo) => {
  vi.mocked(getMkvInfo).mockImplementation(
    (filePath: string) =>
      of(filePath === SOURCE ? source : output),
  )
}

describe(keepSpecifiedLanguageTracks.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()
    vol.fromJSON({
      [SOURCE]: "stream",
      [OUTPUT]: "trimmed-stream",
    })
    vi.mocked(runMkvMerge).mockReturnValue(of(OUTPUT))
  })

  test("keeps all original audio (drops the --audio-tracks filter) when no requested audio language is present", async () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined)
    // French-only featurette on an English-native disc, trimmed to eng.
    mockProbes(
      makeMkvInfo({ audio: ["fre"] }),
      makeMkvInfo({ audio: ["fre"] }),
    )

    const emissions = await firstValueFrom(
      keepSpecifiedLanguageTracks({
        audioLanguages: [{ code: "eng" }],
        filePath: SOURCE,
        subtitlesLanguages: [],
      }).pipe(toArray()),
    )

    const args = mkvMergeArgs()
    expect(args).not.toContain("--audio-tracks")
    expect(emissions).toEqual([OUTPUT])
    expect(warnSpy.mock.calls.flat().join(" ")).toContain(
      "keeping all original audio",
    )
  })

  test("regression: missing-language audio + a subtitle trim keeps the audio instead of producing a silent file", async () => {
    vi.spyOn(console, "warn").mockImplementation(
      () => undefined,
    )
    // Audio track has no language tag (mkvmerge reports "und"); a Spanish
    // subtitle forces the file through the trim. Requesting eng audio + eng
    // subs must NOT strip the only audio track.
    mockProbes(
      makeMkvInfo({ audio: ["und"], subtitles: ["spa"] }),
      makeMkvInfo({ audio: ["und"] }),
    )

    const emissions = await firstValueFrom(
      keepSpecifiedLanguageTracks({
        audioLanguages: [{ code: "eng" }],
        filePath: SOURCE,
        subtitlesLanguages: [{ code: "eng" }],
      }).pipe(toArray()),
    )

    const args = mkvMergeArgs()
    expect(args).not.toContain("--audio-tracks")
    expect(args).toContain("--subtitle-tracks")
    expect(args).toContain("eng")
    expect(emissions).toEqual([OUTPUT])
  })

  test("trims normally when the requested audio language is present", async () => {
    mockProbes(
      makeMkvInfo({ audio: ["eng", "spa"] }),
      makeMkvInfo({ audio: ["eng"] }),
    )

    const emissions = await firstValueFrom(
      keepSpecifiedLanguageTracks({
        audioLanguages: [{ code: "eng" }],
        filePath: SOURCE,
        subtitlesLanguages: [],
      }).pipe(toArray()),
    )

    const args = mkvMergeArgs()
    expect(args).toContain("--audio-tracks")
    expect(args[args.indexOf("--audio-tracks") + 1]).toBe(
      "eng",
    )
    expect(emissions).toEqual([OUTPUT])
  })

  test("post-write assertion: deletes the output and fails the file if the merge somehow produced zero audio", async () => {
    vi.spyOn(console, "error").mockImplementation(
      () => undefined,
    )
    // Source had audio, but the produced output has none — the exact
    // silent-file outcome the guard exists to catch.
    mockProbes(
      makeMkvInfo({ audio: ["eng"] }),
      makeMkvInfo({ audio: [] }),
    )

    const emissions = await firstValueFrom(
      keepSpecifiedLanguageTracks({
        audioLanguages: [{ code: "eng" }],
        filePath: SOURCE,
        subtitlesLanguages: [],
      }).pipe(toArray()),
    )

    // The error is swallowed per-file (logAndSwallowPipelineError) so the
    // batch continues — but no path is emitted and the silent output is gone.
    expect(emissions).toEqual([])
    expect(vol.existsSync(OUTPUT)).toBe(false)
  })
})
