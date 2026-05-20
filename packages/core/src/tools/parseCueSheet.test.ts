import { describe, expect, test } from "vitest"
import { parseCueSheet } from "./parseCueSheet.js"

// Frame conversion: CDDA INDEX timestamps use MM:SS:FF where FF is 1/75 s.
// Total frames = ((mm * 60) + ss) * 75 + ff.

const vanillaCue = [
  'FILE "Album.flac" WAVE',
  "  TRACK 01 AUDIO",
  '    TITLE "Opening"',
  '    PERFORMER "Artist"',
  "    INDEX 01 00:00:00",
  "  TRACK 02 AUDIO",
  '    TITLE "Second Song"',
  '    PERFORMER "Artist"',
  "    INDEX 01 03:25:50",
  "  TRACK 03 AUDIO",
  '    TITLE "Third Song"',
  '    PERFORMER "Artist"',
  "    INDEX 01 07:12:25",
].join("\n")

const pregapCue = [
  'FILE "Album.wav" WAVE',
  "  TRACK 01 AUDIO",
  '    TITLE "First"',
  "    INDEX 01 00:00:00",
  "  TRACK 02 AUDIO",
  '    TITLE "Second"',
  "    INDEX 00 03:00:00",
  "    INDEX 01 03:02:00",
].join("\n")

const multiFileCue = [
  'FILE "Disc1.wav" WAVE',
  "  TRACK 01 AUDIO",
  '    TITLE "First"',
  "    INDEX 01 00:00:00",
  'FILE "Disc2.wav" WAVE',
  "  TRACK 02 AUDIO",
  '    TITLE "Second"',
  "    INDEX 01 00:00:00",
].join("\n")

const missingIndexCue = [
  'FILE "Album.flac" WAVE',
  "  TRACK 01 AUDIO",
  '    TITLE "First"',
  "    INDEX 01 00:00:00",
  "  TRACK 02 AUDIO",
  '    TITLE "No Index"',
].join("\n")

describe(parseCueSheet.name, () => {
  test("parses a vanilla three-track CUE sheet", () => {
    const result = parseCueSheet(vanillaCue)
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") return
    expect(result.audioFileHint).toBe("Album.flac")
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks[0]).toEqual({
      number: 1,
      title: "Opening",
      performer: "Artist",
      startFrame: 0,
    })
    expect(result.tracks[1]).toEqual({
      number: 2,
      title: "Second Song",
      performer: "Artist",
      startFrame: (3 * 60 + 25) * 75 + 50,
    })
    expect(result.tracks[2].startFrame).toBe(
      (7 * 60 + 12) * 75 + 25,
    )
  })

  test("ignores INDEX 00 pregap; uses INDEX 01 as the split boundary", () => {
    const result = parseCueSheet(pregapCue)
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") return
    expect(result.tracks).toHaveLength(2)
    expect(result.tracks[1].startFrame).toBe(
      3 * 60 * 75 + 2 * 75,
    )
  })

  test("returns multiFile error when CUE references more than one FILE", () => {
    const result = parseCueSheet(multiFileCue)
    expect(result.kind).toBe("error")
    if (result.kind !== "error") return
    expect(result.reason).toBe("multiFile")
  })

  test("returns missingIndex error when a track has no INDEX 01", () => {
    const result = parseCueSheet(missingIndexCue)
    expect(result.kind).toBe("error")
    if (result.kind !== "error") return
    expect(result.reason).toBe("missingIndex")
  })

  test("returns empty error on an empty CUE string", () => {
    const result = parseCueSheet("")
    expect(result.kind).toBe("error")
    if (result.kind !== "error") return
    expect(result.reason).toBe("empty")
  })
})
