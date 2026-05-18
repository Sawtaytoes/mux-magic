import { captureConsoleMessage } from "@mux-magic/tools"
import { vol } from "memfs"
import { EMPTY, firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { MkvInfo } from "../tools/getMkvInfo.js"
import { reorderTracks } from "./reorderTracks.js"

vi.mock("../tools/getMkvInfo.js", () => ({
  getMkvInfo: vi.fn(),
}))

vi.mock(
  "../cli-spawn-operations/reorderTracksFfmpeg.js",
  () => ({
    reorderTracksFfmpeg: vi.fn(),
    reorderTracksFfmpegDefaultProps: {
      outputFolderName: "REORDERED-TRACKS",
    },
  }),
)

vi.mock(
  "../cli-spawn-operations/setOnlyFirstTracksAsDefault.js",
  () => ({
    setOnlyFirstTracksAsDefault: vi.fn(),
  }),
)

const { getMkvInfo } = await import(
  "../tools/getMkvInfo.js"
)
const { reorderTracksFfmpeg } = await import(
  "../cli-spawn-operations/reorderTracksFfmpeg.js"
)
const { setOnlyFirstTracksAsDefault } = await import(
  "../cli-spawn-operations/setOnlyFirstTracksAsDefault.js"
)

const makeMkvInfoWithAudioTracks = (
  audioTrackCount: number,
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
  file_name: "/work/episode-01.mkv",
  global_tags: [],
  identification_format_version: 12,
  track_tags: [],
  tracks: Array.from(
    { length: audioTrackCount },
    (_, index) => ({
      codec: "AAC",
      id: index,
      properties: {
        codec_id: "A_AAC",
        codec_private_length: 0,
        isDefaultTrack: index === 0,
        isEnabledTrack: true,
        isForcedTrack: false,
        language: "und" as const,
        num_index_entries: 0,
        number: index + 1,
        uid: index + 1,
      },
      type: "audio" as const,
    }),
  ),
  warnings: [],
})

describe(reorderTracks.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/episode-01.mkv": "stream",
    })
  })

  test("returns EMPTY when every track-index array is empty (no-op fast path)", async () =>
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        reorderTracks({
          audioTrackIndexes: [],
          isRecursive: false,
          sourcePath: "/work",
          subtitlesTrackIndexes: [],
          videoTrackIndexes: [],
        }).pipe(toArray()),
      )
      expect(emissions).toEqual([])
    }))

  test("returns EMPTY when track-index arrays are nullish (defensive)", async () =>
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        reorderTracks({
          // @ts-expect-error — defensive: callers from JS / loose schemas
          // could ship undefined; verify the guard handles it without crashing.
          audioTrackIndexes: undefined,
          isRecursive: false,
          sourcePath: "/work",
          // @ts-expect-error
          subtitlesTrackIndexes: undefined,
          // @ts-expect-error
          videoTrackIndexes: undefined,
        }).pipe(toArray()),
      )
      expect(emissions).toEqual([])
    }))

  describe("isSkipOnTrackMisalignment", () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vol.fromJSON({ "/work/episode-01.mkv": "stream" })
      vi.mocked(getMkvInfo).mockReturnValue(
        of(makeMkvInfoWithAudioTracks(2)),
      )
      vi.mocked(reorderTracksFfmpeg).mockReturnValue(
        of("/work/REORDERED-TRACKS/episode-01.mkv"),
      )
      vi.mocked(
        setOnlyFirstTracksAsDefault,
      ).mockReturnValue(EMPTY)
    })

    test("skips file and logs warning when true and audio indexes exceed actual track count", async () => {
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined)

      const emissions = await firstValueFrom(
        reorderTracks({
          audioTrackIndexes: [0, 1, 2],
          isRecursive: false,
          isSkipOnTrackMisalignment: true,
          sourcePath: "/work",
          subtitlesTrackIndexes: [],
          videoTrackIndexes: [],
        }).pipe(toArray()),
      )

      expect(emissions).toEqual([])
      expect(
        vi.mocked(reorderTracksFfmpeg),
      ).not.toHaveBeenCalled()

      const warningText = warnSpy.mock.calls
        .flat()
        .join(" ")
      expect(warningText).toContain("track misalignment")
      expect(warningText).toContain("expected 3")
      expect(warningText).toContain("got 2")
    })

    test("throws with alignment guidance when false and audio indexes exceed actual track count", async () => {
      await expect(
        firstValueFrom(
          reorderTracks({
            audioTrackIndexes: [0, 1, 2],
            isRecursive: false,
            isSkipOnTrackMisalignment: false,
            sourcePath: "/work",
            subtitlesTrackIndexes: [],
            videoTrackIndexes: [],
          }).pipe(toArray()),
        ),
      ).rejects.toThrow(
        "tracks should align if the command was added correctly",
      )
    })
  })
})
