import { describe, expect, test } from "vitest"
import { findConvertLosslessResults } from "./findConvertLosslessResults"

describe(findConvertLosslessResults.name, () => {
  test("returns empty bins for undefined", () => {
    expect(findConvertLosslessResults(undefined)).toEqual({
      converted: [],
      skipped: [],
    })
  })

  test("partitions converted and skipped records", () => {
    const result = findConvertLosslessResults([
      {
        kind: "converted",
        source: "/a.wav",
        destination: "/a.flac",
      },
      {
        kind: "skipped",
        source: "/b.wav",
        reason: "float-pcm",
      },
      {
        kind: "skipped",
        source: "/c.dff",
        reason: "dsd",
      },
    ])
    expect(result.converted).toEqual([
      {
        kind: "converted",
        source: "/a.wav",
        destination: "/a.flac",
      },
    ])
    expect(result.skipped).toEqual([
      {
        kind: "skipped",
        source: "/b.wav",
        reason: "float-pcm",
      },
      {
        kind: "skipped",
        source: "/c.dff",
        reason: "dsd",
      },
    ])
  })

  test("ignores unrelated record shapes (NSF rename pairs, summaries, arbitrary objects)", () => {
    const result = findConvertLosslessResults([
      { oldName: "x", newName: "y" },
      { unrenamedFilenames: [], possibleNames: [] },
      {
        kind: "skipped",
        source: "/d.wav",
        reason: "bogus",
      },
      null,
      "string",
      42,
    ])
    expect(result).toEqual({ converted: [], skipped: [] })
  })
})
