import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { buildSimpleChapters } from "./buildSimpleChapters.js"
import { parseMpls } from "./parseMpls.js"

const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadPlaylist = (fixtureName: string) =>
  parseMpls(
    realFs.readFileSync(
      join(
        import.meta.dirname,
        "__fixtures__",
        fixtureName,
      ),
    ),
  )

describe(buildSimpleChapters.name, () => {
  test("renders Soylent Green's 12 chapters, starting at zero", () => {
    const lines = buildSimpleChapters({
      playlist: loadPlaylist("soylent-green-00012.mpls"),
    })
      .trim()
      .split("\n")

    expect(
      lines.filter(
        (line) =>
          line.endsWith("NAME=") === false &&
          line.includes("NAME") === false,
      ),
    ).toHaveLength(12)
    expect(lines.at(0)).toBe("CHAPTER01=00:00:00.000")
    expect(lines.at(1)).toBe("CHAPTER01NAME=Chapter 1")
  })

  test("drops the end marker rather than writing a zero-length final chapter", () => {
    const playlist = loadPlaylist(
      "soylent-green-00012.mpls",
    )
    const chapterCount = buildSimpleChapters({ playlist })
      .trim()
      .split("\n")
      .filter((line) => line.includes("NAME")).length

    // MakeMKV reports one fewer chapter than there are marks for exactly
    // this reason — the last mark lands on the playlist's end.
    expect(chapterCount).toBe(
      playlist.chapterMarks.length - 1,
    )
  })

  test("timestamps are monotonic across a multi-segment playlist", () => {
    // The raw marks are per-clip and restart at every play item, so a
    // naive graft puts everything after segment 1 in the wrong place.
    const timestamps = buildSimpleChapters({
      playlist: loadPlaylist("the-outfit-00011.mpls"),
    })
      .trim()
      .split("\n")
      .filter((line) => line.includes("NAME") === false)
      .map((line) => line.split("=").at(1) ?? "")

    expect(timestamps).toEqual([...timestamps].sort())
  })
})
