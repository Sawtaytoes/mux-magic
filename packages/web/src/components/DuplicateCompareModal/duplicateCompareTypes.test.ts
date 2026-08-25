import { describe, expect, test } from "vitest"

import {
  AUTO_CHECKED_MATCH_REASONS,
  countRedundantCopies,
  dropResolvedDuplicateGroups,
  findDuplicateGroups,
  formatQuality,
  isDuplicateGroup,
} from "./duplicateCompareTypes"
import { buildDuplicateGroup } from "./duplicateFixtures"

describe(isDuplicateGroup.name, () => {
  test("accepts a server duplicate group", () => {
    expect(isDuplicateGroup(buildDuplicateGroup())).toBe(
      true,
    )
  })

  test.each([
    ["null", null],
    ["a string", "duplicate"],
    ["an object without the marker", { copies: [] }],
    [
      "a music match cluster",
      { files: [], isMusicMatch: true },
    ],
  ])("rejects %s", (_label, entry) => {
    expect(isDuplicateGroup(entry)).toBe(false)
  })
})

describe(findDuplicateGroups.name, () => {
  // The results stream carries every record kind a run produced. Picking
  // ours out by marker is what keeps an unrelated command's output from
  // rendering as a duplicate group.
  test("picks duplicate groups out of a mixed results stream", () => {
    expect(
      findDuplicateGroups([
        { files: [], isMusicMatch: true },
        buildDuplicateGroup(),
        "some log line",
      ]),
    ).toHaveLength(1)
  })

  test("survives a run with no results at all", () => {
    expect(findDuplicateGroups(null)).toEqual([])
  })
})

describe(countRedundantCopies.name, () => {
  test("counts every copy that is not the recommended keep", () => {
    expect(
      countRedundantCopies([
        buildDuplicateGroup({ groupKey: "a" }),
        buildDuplicateGroup({ groupKey: "b" }),
      ]),
    ).toBe(2)
  })
})

describe(dropResolvedDuplicateGroups.name, () => {
  // Re-opening the table after a confirm must not offer the same move a
  // second time — the file is already out of the library.
  test("drops a group once its redundant copy has moved", () => {
    expect(
      dropResolvedDuplicateGroups({
        groups: [buildDuplicateGroup()],
        resolvedFilePaths: [
          "/library/Harbour Lights/Long Way Down/01 Tidewater.mp3",
        ],
      }),
    ).toEqual([])
  })

  test("leaves an untouched group alone", () => {
    expect(
      dropResolvedDuplicateGroups({
        groups: [buildDuplicateGroup()],
        resolvedFilePaths: [],
      }),
    ).toHaveLength(1)
  })
})

describe("AUTO_CHECKED_MATCH_REASONS", () => {
  // The safety default, asserted rather than assumed. Only identical
  // audio is proof; a fingerprint or tag match starting checked would
  // let someone confirm a whole table and move a file on a coincidence.
  test("only identical audio starts checked", () => {
    expect(AUTO_CHECKED_MATCH_REASONS).toEqual(["audio"])
  })
})

describe(formatQuality.name, () => {
  test("reads out the facts the ranking used", () => {
    expect(
      formatQuality({
        bitDepth: 24,
        codec: "FLAC",
        fileSizeBytes: 61_200_000,
        filePath: "/library/track.flac",
        hasEmbeddedCoverArt: false,
        sampleRate: 96_000,
      }),
    ).toBe("FLAC · 24-bit · 96.0 kHz · 61.2 MB")
  })

  test("omits what the file did not report", () => {
    expect(
      formatQuality({
        codec: "MP3",
        fileSizeBytes: 8_100_000,
        filePath: "/library/track.mp3",
        hasEmbeddedCoverArt: false,
      }),
    ).toBe("MP3 · 8.1 MB")
  })
})
