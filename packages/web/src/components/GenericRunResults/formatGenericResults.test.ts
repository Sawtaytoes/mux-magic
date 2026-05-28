import { describe, expect, test } from "vitest"
import { formatGenericResults } from "./formatGenericResults"

describe("formatGenericResults", () => {
  test("returns empty for nullish / empty input", () => {
    expect(formatGenericResults(null).kind).toBe("empty")
    expect(formatGenericResults(undefined).kind).toBe(
      "empty",
    )
    expect(formatGenericResults([]).kind).toBe("empty")
  })

  test("recognizes the getAudioOffsets shape and lists the filename + offset", () => {
    const view = formatGenericResults([
      {
        destinationFilePath:
          "G:\\Anime\\Code Geass\\episode 01.mkv",
        offsetInMilliseconds: 656,
        sourceFilePath:
          "G:\\Anime\\Code Geass good\\episode 01.mkv",
      },
    ])
    expect(view.kind).toBe("audioOffsets")
    if (view.kind !== "audioOffsets") return
    expect(view.rows).toEqual([
      {
        label: "episode 01.mkv",
        offsetInMilliseconds: 656,
      },
    ])
  })

  test("flattens a nested array (the shape getAudioOffsets actually emits)", () => {
    const view = formatGenericResults([
      [
        {
          destinationFilePath: "/movies/A.mkv",
          offsetInMilliseconds: 100,
        },
        {
          destinationFilePath: "/movies/B.mkv",
          offsetInMilliseconds: -50,
        },
      ],
    ])
    expect(view.kind).toBe("audioOffsets")
    if (view.kind !== "audioOffsets") return
    expect(view.rows).toHaveLength(2)
    expect(view.rows[1]).toEqual({
      label: "B.mkv",
      offsetInMilliseconds: -50,
    })
  })

  test("renders rename pairs for {oldName, newName}", () => {
    const view = formatGenericResults([
      { oldName: "raw_01.mkv", newName: "Episode 01.mkv" },
      { oldName: "raw_02.mkv", newName: "Episode 02.mkv" },
    ])
    expect(view.kind).toBe("renames")
    if (view.kind !== "renames") return
    expect(view.rows[0]).toEqual({
      fromValue: "raw_01.mkv",
      toValue: "Episode 01.mkv",
    })
  })

  test("renders rename pairs for {source, destination}", () => {
    const view = formatGenericResults([
      {
        source: "/in/file.flac",
        destination: "/out/file.flac",
      },
    ])
    expect(view.kind).toBe("renames")
  })

  test("renders a path list for string[] results (e.g. replaceTracks output files)", () => {
    const view = formatGenericResults([
      "/out/A.mkv",
      "/out/B.mkv",
    ])
    expect(view.kind).toBe("paths")
    if (view.kind !== "paths") return
    expect(view.rows).toEqual(["/out/A.mkv", "/out/B.mkv"])
  })

  test("falls back to a JSON dump for unknown shapes", () => {
    const view = formatGenericResults([
      { mystery: true, nested: { count: 3 } },
    ])
    expect(view.kind).toBe("json")
    if (view.kind !== "json") return
    expect(view.text).toContain("mystery")
  })
})
