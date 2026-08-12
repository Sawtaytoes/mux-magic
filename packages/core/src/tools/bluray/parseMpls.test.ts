import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import {
  getMplsChapterTimesFromPlaylistStart,
  getMplsSegmentFileNames,
  getMplsTotalDurationSeconds,
  parseMpls,
} from "./parseMpls.js"

// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read the on-disk byte fixtures at module init.
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "__fixtures__",
)
const loadPlaylist = (fixtureName: string) =>
  parseMpls(
    realFs.readFileSync(join(FIXTURES_DIR, fixtureName)),
  )

describe(parseMpls.name, () => {
  test("rejects a file that is not an MPLS playlist", () => {
    expect(() =>
      parseMpls(Buffer.from("not a playlist at all")),
    ).toThrow("Not an MPLS playlist")
  })

  test("reads The Outfit's two-segment cut", () => {
    // makemkvcon reports this title as segments "4,6", 12 chapters,
    // 1:41:10. The playlist has to agree.
    const playlist = loadPlaylist("the-outfit-00011.mpls")

    expect(playlist.version).toBe("0200")
    // makemkvcon reports the segment map as "4,6" and the playlist agrees
    // on those two — plus a ~1-second bumper clip makemkvcon leaves out of
    // its map entirely. Both are right; they answer different questions.
    expect(getMplsSegmentFileNames(playlist)).toEqual([
      "00004.m2ts",
      "00006.m2ts",
      "00016.m2ts",
    ])
  })

  test("total play-item duration matches makemkvcon's reported runtime", () => {
    // The Outfit 00011.mpls — makemkvcon says 1:41:10 (6070s).
    const totalSeconds = getMplsTotalDurationSeconds(
      loadPlaylist("the-outfit-00011.mpls"),
    )

    expect(totalSeconds).toBeGreaterThan(6060)
    expect(totalSeconds).toBeLessThan(6080)
  })

  test("raw mark timestamps are per-clip and NOT monotonic across play items", () => {
    // The trap this parser exists to avoid. Marks are in each clip's own
    // timebase and restart at every play item, so grafting them raw would
    // put every chapter after the first segment in the wrong place.
    const rawTimestamps = loadPlaylist(
      "the-outfit-00011.mpls",
    ).chapterMarks.map((mark) => mark.timestampSeconds)

    expect(
      rawTimestamps.every(
        (timestamp, index) =>
          index === 0 ||
          timestamp >= rawTimestamps[index - 1],
      ),
    ).toBe(false)
  })

  test("playlist-relative chapter times ARE monotonic, and the last mark is the end", () => {
    const playlist = loadPlaylist("the-outfit-00011.mpls")
    const chapterTimes =
      getMplsChapterTimesFromPlaylistStart(playlist)
    const secondsFromStart = chapterTimes.map(
      (chapterTime) => chapterTime.secondsFromStart,
    )

    expect(
      secondsFromStart.every(
        (seconds, index) =>
          index === 0 ||
          seconds >= secondsFromStart[index - 1],
      ),
    ).toBe(true)
    expect(secondsFromStart[0]).toBe(0)

    // 13 marks, the last landing on the playlist end — which is why
    // makemkvcon reports 12 chapters for this title.
    expect(chapterTimes).toHaveLength(13)
    expect(
      chapterTimes.filter(
        (chapterTime) => !chapterTime.isPlaylistEndMarker,
      ),
    ).toHaveLength(12)
  })

  test("Soylent Green's feature playlist exposes its audio PIDs and languages", () => {
    // The graft path needs a PID per audio track. makemkvcon reports this
    // title as 2 x DD 2.0 English plus 2 subtitle tracks.
    const playlist = loadPlaylist(
      "soylent-green-00012.mpls",
    )
    const audioStreams =
      playlist.playItems[0].streams.filter(
        (stream) => stream.streamKind === "primaryAudio",
      )

    expect(getMplsSegmentFileNames(playlist)[0]).toBe(
      "00425.m2ts",
    )
    expect(audioStreams).toHaveLength(2)
    audioStreams.forEach((stream) => {
      expect(stream.languageCode).toBe("eng")
      // 0x81 = AC-3, matching makemkvcon's "DD 2.0 English" x2.
      expect(stream.codingType).toBe(0x81)
    })
    expect(
      audioStreams.map((stream) => stream.packetId),
    ).toEqual([0x1101, 0x1102])
    // The UHD video track: 0x24 is HEVC, on the standard 0x1011 PID.
    expect(playlist.playItems[0].streams[0]).toMatchObject({
      codingType: 0x24,
      packetId: 0x1011,
      streamKind: "primaryVideo",
    })
    expect(
      new Set(audioStreams.map((stream) => stream.packetId))
        .size,
    ).toBe(2)
  })

  test("recovers the full segment list makemkvcon truncated", () => {
    // THE reason this parser exists. makemkvcon reports 236 segments for
    // this title and then elides the map with a trailing "...", so the
    // robot-mode field is a prefix. The playlist itself is not.
    const playlist = loadPlaylist(
      "soylent-green-00010.mpls",
    )

    expect(playlist.playItems).toHaveLength(236)
    expect(getMplsSegmentFileNames(playlist)[0]).toBe(
      "00010.m2ts",
    )
    // Every clip name is a real 5-digit stream id — proof the walk stayed
    // aligned across all 236 variable-length play items rather than
    // drifting into garbage partway through.
    expect(
      getMplsSegmentFileNames(playlist).every((fileName) =>
        /^\d{5}\.m2ts$/.test(fileName),
      ),
    ).toBe(true)
  })
})
