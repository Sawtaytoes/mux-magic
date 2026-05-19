import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { MkvInfo, Track } from "../tools/getMkvInfo.js"
import { extractSubtitles } from "./extractSubtitles.js"

vi.mock("../tools/getMkvInfo.js", () => ({
  getMkvInfo: vi.fn(),
}))

vi.mock(
  "../cli-spawn-operations/extractSubtitleTracks.js",
  () => ({
    extractSubtitleTracks: vi.fn(),
    extractSubtitleTracksDefaultProps: {
      outputFolderName: "EXTRACTED-SUBTITLES",
    },
  }),
)

const { getMkvInfo } = await import(
  "../tools/getMkvInfo.js"
)
const { extractSubtitleTracks } = await import(
  "../cli-spawn-operations/extractSubtitleTracks.js"
)

type SubtitleTrackInput = {
  codecId: string
  language: string
  number: number
}

const makeSubtitleTrack = ({
  codecId,
  language,
  number,
}: SubtitleTrackInput): Track => ({
  codec: codecId,
  id: number - 1,
  properties: {
    codec_id: codecId,
    codec_private_length: 0,
    isDefaultTrack: false,
    isEnabledTrack: true,
    isForcedTrack: false,
    language: language as Track["properties"]["language"],
    num_index_entries: 0,
    number,
    uid: number,
  },
  type: "subtitles",
})

const makeMkvInfoWithSubtitleTracks = (
  tracks: ReadonlyArray<SubtitleTrackInput>,
): MkvInfo => ({
  attachments: [],
  chapters: [],
  container: {
    isRecognized: true,
    isSupported: true,
    properties: {
      container_type: 17,
      date_local: "",
      date_utc: "",
      duration: 0,
      is_providing_timestamps: true,
      muxing_application: "test",
      segment_uid: "00000000000000000000000000000000",
      title: "",
      writing_application: "test",
    },
    type: "Matroska",
  },
  errors: [],
  file_name: "/work/episode.mkv",
  global_tags: [],
  identification_format_version: 12,
  track_tags: [],
  tracks: tracks.map(makeSubtitleTrack),
  warnings: [],
})

describe(extractSubtitles.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.fromJSON({ "/work/episode.mkv": "stream" })
    vi.mocked(extractSubtitleTracks).mockReturnValue(
      of([
        "/work/EXTRACTED-SUBTITLES/episode.mkv/track.ass",
      ]),
    )
  })

  test("typesMode 'none' with empty languages extracts every subtitle track", async () => {
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_TEXT/UTF8",
            language: "jpn",
            number: 3,
          },
          {
            codecId: "S_HDMV/PGS",
            language: "eng",
            number: 4,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(extractSubtitleTracks).toHaveBeenCalledTimes(1)
    const callTracks = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0].tracks
    expect(
      callTracks.map((track) => track.codec_id),
    ).toEqual(["S_TEXT/ASS", "S_TEXT/UTF8", "S_HDMV/PGS"])
  })

  test("typesMode 'include' with [ass] keeps only ASS tracks", async () => {
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_TEXT/UTF8",
            language: "eng",
            number: 3,
          },
          {
            codecId: "S_HDMV/PGS",
            language: "eng",
            number: 4,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
        subtitleTypes: ["ass"],
        typesMode: "include",
      }).pipe(toArray()),
    )

    const callTracks = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0].tracks
    expect(
      callTracks.map((track) => track.codec_id),
    ).toEqual(["S_TEXT/ASS"])
  })

  test("typesMode 'exclude' with [sup] drops both PGS and TextST", async () => {
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_HDMV/PGS",
            language: "eng",
            number: 3,
          },
          {
            codecId: "S_HDMV/TEXTST",
            language: "eng",
            number: 4,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
        subtitleTypes: ["sup"],
        typesMode: "exclude",
      }).pipe(toArray()),
    )

    const callTracks = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0].tracks
    expect(
      callTracks.map((track) => track.codec_id),
    ).toEqual(["S_TEXT/ASS"])
  })

  test("subtitlesLanguages [eng, jpn] keeps both languages", async () => {
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_TEXT/UTF8",
            language: "jpn",
            number: 3,
          },
          {
            codecId: "S_TEXT/UTF8",
            language: "spa",
            number: 4,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
        subtitlesLanguages: ["eng", "jpn"],
      }).pipe(toArray()),
    )

    const callTracks = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0].tracks
    expect(
      callTracks.map((track) => track.languageCode),
    ).toEqual(["eng", "jpn"])
  })

  test("emits a single batched extractSubtitleTracks invocation per source file", async () => {
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_TEXT/UTF8",
            language: "jpn",
            number: 3,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(extractSubtitleTracks).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0]
    expect(callArgs.filePath).toMatch(
      /[/\\]work[/\\]episode\.mkv$/,
    )
    expect(callArgs.tracks).toEqual([
      expect.objectContaining({
        codec_id: "S_TEXT/ASS",
        trackId: 1,
      }),
      expect.objectContaining({
        codec_id: "S_TEXT/UTF8",
        trackId: 2,
      }),
    ])
  })

  test("unknown codec with typesMode 'none' is logged then skipped (no batched call when nothing else remains)", async () =>
    captureConsoleMessage("info", async () => {
      vi.mocked(getMkvInfo).mockReturnValue(
        of(
          makeMkvInfoWithSubtitleTracks([
            {
              codecId: "S_FUTURE/UNKNOWN",
              language: "eng",
              number: 2,
            },
          ]),
        ),
      )

      await firstValueFrom(
        extractSubtitles({
          isRecursive: false,
          sourcePath: "/work",
        }).pipe(toArray()),
      )

      expect(extractSubtitleTracks).not.toHaveBeenCalled()
    }))

  test("unknown codec with typesMode 'include' is silently skipped (not logged)", async () => {
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined)
    vi.mocked(getMkvInfo).mockReturnValue(
      of(
        makeMkvInfoWithSubtitleTracks([
          {
            codecId: "S_FUTURE/UNKNOWN",
            language: "eng",
            number: 2,
          },
          {
            codecId: "S_TEXT/ASS",
            language: "eng",
            number: 3,
          },
        ]),
      ),
    )

    await firstValueFrom(
      extractSubtitles({
        isRecursive: false,
        sourcePath: "/work",
        subtitleTypes: ["ass"],
        typesMode: "include",
      }).pipe(toArray()),
    )

    const hasUnknownCodecLog = infoSpy.mock.calls
      .flat()
      .join(" ")
      .includes("SKIPPING UNKNOWN CODEC")
    expect(hasUnknownCodecLog).toBe(false)
    const callTracks = vi.mocked(extractSubtitleTracks).mock
      .calls[0][0].tracks
    expect(
      callTracks.map((track) => track.codec_id),
    ).toEqual(["S_TEXT/ASS"])
  })
})
