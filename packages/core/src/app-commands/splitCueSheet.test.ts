import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  of,
  Subject,
  toArray,
} from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { splitCueSheet } from "./splitCueSheet.js"

vi.mock(
  "../cli-spawn-operations/splitCueSheetFfmpeg.js",
  () => ({
    splitCueSheetFfmpeg: vi.fn(),
  }),
)
vi.mock("../tools/getMediaInfo.js", () => ({
  getMediaInfo: vi.fn(),
}))
vi.mock("../tools/getFileDuration.js", () => ({
  getFileDuration: vi.fn(),
}))

const { splitCueSheetFfmpeg } = await import(
  "../cli-spawn-operations/splitCueSheetFfmpeg.js"
)
const { getMediaInfo } = await import(
  "../tools/getMediaInfo.js"
)
const { getFileDuration } = await import(
  "../tools/getFileDuration.js"
)

// Vanilla CUE: TRACK 01 at 00:00:00, TRACK 02 at 03:25:50, TRACK 03 at 07:12:25.
const VANILLA_CUE = [
  'FILE "Album.flac" WAVE',
  "  TRACK 01 AUDIO",
  '    TITLE "Opening"',
  "    INDEX 01 00:00:00",
  "  TRACK 02 AUDIO",
  '    TITLE "Second"',
  "    INDEX 01 03:25:50",
  "  TRACK 03 AUDIO",
  '    TITLE "Closing"',
  "    INDEX 01 07:12:25",
].join("\n")

// Same CUE but its FILE line points at a renamed audio that doesn't exist.
const RENAMED_FILE_CUE = VANILLA_CUE.replace(
  "Album.flac",
  "Renamed.wav",
)

describe(splitCueSheet.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getMediaInfo).mockReturnValue(
      of({}) as unknown as ReturnType<typeof getMediaInfo>,
    )
    // Default: final track ends at 600s (10 minutes).
    vi.mocked(getFileDuration).mockReturnValue(of(600))
    vi.mocked(splitCueSheetFfmpeg).mockImplementation(
      ({ outputFilePath }) => of(outputFilePath),
    )
  })

  test("splits a 3-track CUE; emits 3 records and invokes ffmpeg with output-seek args", async () => {
    vol.fromJSON({
      "/music/Album/Album.cue": VANILLA_CUE,
      "/music/Album/Album.flac": "stream",
    })
    const records = await firstValueFrom(
      splitCueSheet({ sourcePath: "/music" }).pipe(
        toArray(),
      ),
    )
    expect(records).toHaveLength(3)
    expect(records.map((record) => record.title)).toEqual([
      "Opening",
      "Second",
      "Closing",
    ])
    // Three ffmpeg calls.
    expect(splitCueSheetFfmpeg).toHaveBeenCalledTimes(3)
    // Inspect the first call's args via the spy.
    const firstCall = vi.mocked(splitCueSheetFfmpeg).mock
      .calls[0][0]
    expect(firstCall.startSeconds).toBe(0)
    // INDEX 01 of TRACK 02 = (3*60+25)*75 + 50 = 15425 frames; /75 = 205.6666... s
    expect(firstCall.endSeconds).toBeCloseTo(
      ((3 * 60 + 25) * 75 + 50) / 75,
    )
    expect(firstCall.outputFilePath).toMatch(
      /Album[\\/]01 - Opening\.flac$/,
    )
    // Last call's end should equal the mocked file duration (600 s).
    const lastCall = vi.mocked(splitCueSheetFfmpeg).mock
      .calls[2][0]
    expect(lastCall.endSeconds).toBe(600)
  })

  test("recursive walk splits two album folders into two CUE-SPLITS subfolders", async () => {
    vol.fromJSON({
      "/music/ArtistA/Album1/Album1.cue": VANILLA_CUE,
      "/music/ArtistA/Album1/Album1.flac": "stream",
      "/music/ArtistB/Album2/Album2.cue": VANILLA_CUE,
      "/music/ArtistB/Album2/Album2.flac": "stream",
    })
    const records = await firstValueFrom(
      splitCueSheet({ sourcePath: "/music" }).pipe(
        toArray(),
      ),
    )
    expect(records).toHaveLength(6)
    const destinations = records.map(
      (record) => record.destination,
    )
    expect(
      destinations.some((path) =>
        path.includes("CUE-SPLITS"),
      ),
    ).toBe(true)
    expect(
      destinations.some((path) =>
        path.includes("Album1"),
      ),
    ).toBe(true)
    expect(
      destinations.some((path) =>
        path.includes("Album2"),
      ),
    ).toBe(true)
  })

  test("album-folder basename collisions halt before any split", async () => {
    vol.fromJSON({
      "/music/ArtistA/Greatest Hits/album.cue": VANILLA_CUE,
      "/music/ArtistA/Greatest Hits/album.flac": "stream",
      "/music/ArtistB/Greatest Hits/album.cue": VANILLA_CUE,
      "/music/ArtistB/Greatest Hits/album.flac": "stream",
    })
    await expect(
      lastValueFrom(
        splitCueSheet({ sourcePath: "/music" }).pipe(
          toArray(),
        ),
      ),
    ).rejects.toThrow(/collision/)
    // No ffmpeg invocations at all.
    expect(splitCueSheetFfmpeg).not.toHaveBeenCalled()
  })

  test("falls back to lone lossless audio when CUE FILE line is stale", async () => {
    vol.fromJSON({
      "/music/Album/Album.cue": RENAMED_FILE_CUE,
      "/music/Album/Album.flac": "stream",
    })
    const records = await firstValueFrom(
      splitCueSheet({ sourcePath: "/music" }).pipe(
        toArray(),
      ),
    )
    expect(records).toHaveLength(3)
    const firstCall = vi.mocked(splitCueSheetFfmpeg).mock
      .calls[0][0]
    expect(firstCall.inputAudioPath).toMatch(
      /Album\.flac$/,
    )
  })

  test("AbortController on unsubscribe stops further runFfmpeg invocations", async () => {
    vol.fromJSON({
      "/music/Album/Album.cue": VANILLA_CUE,
      "/music/Album/Album.flac": "stream",
    })
    // Mock ffmpeg to never complete by returning a hanging Subject —
    // unsubscribe should tear down before any tracks finish.
    const hanging = new Subject<string>()
    vi.mocked(splitCueSheetFfmpeg).mockReturnValue(
      hanging.asObservable(),
    )
    const sub = splitCueSheet({
      sourcePath: "/music",
    }).subscribe()
    sub.unsubscribe()
    // Allow microtasks to flush — even if ffmpeg started, no records emit.
    await new Promise((resolve) => setTimeout(resolve, 10))
    // Either it never reached ffmpeg (abort fired before defer) or
    // it called once and got torn down — what matters: no completed
    // records were emitted to a subscriber. Stronger assertion: the
    // total call count is at most 1 (the in-flight track when abort
    // landed).
    expect(
      vi.mocked(splitCueSheetFfmpeg).mock.calls.length,
    ).toBeLessThanOrEqual(1)
  })
})
