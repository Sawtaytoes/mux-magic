import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { parseTitleGraph } from "./parseTitleGraph.js"

// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read on-disk fixtures at module init (same pattern as
// searchDvdCompare.test.ts).
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "__fixtures__",
)
const loadFixture = (fixtureName: string): string =>
  realFs.readFileSync(
    join(FIXTURES_DIR, fixtureName),
    "utf8",
  )

const allFixtureNames = [
  "desk-set-bluray.robot.log",
  "soylent-green-uhd.robot.log",
  "the-outfit-bluray.robot.log",
  "the-people-vs-larry-flynt-uhd.robot.log",
  "troy-bonus-disc-bluray.robot.log",
  "troy-directors-cut-uhd.robot.log",
  "troy-theatrical-cut-uhd.robot.log",
]

describe(parseTitleGraph.name, () => {
  test("parses every captured fixture with zero malformed lines", () => {
    // Real `makemkvcon -r` output across seven discs. A malformed line
    // here means the scanner met a quoting shape it does not handle —
    // which is how the whole message gets silently dropped.
    allFixtureNames.forEach((fixtureName) => {
      const graph = parseTitleGraph(
        loadFixture(fixtureName),
      )
      expect({
        fixtureName,
        malformedLineCount: graph.malformedLineCount,
      }).toEqual({ fixtureName, malformedLineCount: 0 })
    })
  })

  test("every fixture's title count matches makemkvcon's own TCOUNT", () => {
    allFixtureNames.forEach((fixtureName) => {
      const graph = parseTitleGraph(
        loadFixture(fixtureName),
      )
      expect({
        fixtureName,
        titles: graph.titles.length,
      }).toEqual({
        fixtureName,
        titles: graph.reportedTitleCount,
      })
    })
  })

  test("reads Desk Set's main feature off the playlist, not a stream", () => {
    const graph = parseTitleGraph(
      loadFixture("desk-set-bluray.robot.log"),
    )
    const mainFeature = graph.titles.find(
      (title) => title.sourceFileName === "00850.mpls",
    )

    expect(mainFeature).toMatchObject({
      chapterCount: 24,
      durationSeconds: 6213,
      durationText: "1:43:33",
      isSegmentMapTruncated: false,
      segmentCount: 1,
      segmentMap: [800],
    })
  })

  test("labels a stream's real track language, not the disc metadata language", () => {
    // LANG_CODE (3) is the track language; METADATA_LANGUAGE_CODE (28) is
    // "eng" on every stream of an English disc including the video, so
    // reading 28 would label every commentary English and hide the thing
    // we are looking for.
    const graph = parseTitleGraph(
      loadFixture("desk-set-bluray.robot.log"),
    )
    const mainFeature = graph.titles.find(
      (title) => title.sourceFileName === "00850.mpls",
    )

    expect(mainFeature?.streams[0]).toMatchObject({
      codecId: "V_MPEG4/ISO/AVC",
      kind: "video",
      // The video track carries no track language at all.
      languageCode: "",
      videoSize: "1920x1080",
    })
    expect(mainFeature?.streams[1]).toMatchObject({
      channelCount: 1,
      codecShort: "DTS-HD MA",
      kind: "audio",
      languageCode: "eng",
    })
  })

  test("Soylent Green: three full-length playlists share one segment map", () => {
    // The hard case. `00012.mpls`, `00004.mpls` and `00001.mpls` all
    // report 12 chapters / 1:36:48 / 65.5 GB and all map to segment 425 —
    // so they are three playlists over ONE video file, not three
    // editions. Ripping all three would cost ~197 GB for ~65 GB of video.
    const graph = parseTitleGraph(
      loadFixture("soylent-green-uhd.robot.log"),
    )
    const fullLengthPlaylists = graph.titles.filter(
      (title) =>
        title.sourceFileName.endsWith(".mpls") &&
        title.durationText === "1:36:48",
    )

    expect(
      fullLengthPlaylists.map(
        (title) => title.sourceFileName,
      ),
    ).toEqual(["00012.mpls", "00004.mpls", "00001.mpls"])
    expect(
      fullLengthPlaylists.every(
        (title) =>
          title.segmentMapText === "425" &&
          title.chapterCount === 12,
      ),
    ).toBe(true)
  })

  test("Soylent Green: the raw 00425.m2ts twin is chapterless", () => {
    // Same segment, same runtime, no chapter marks — the shape that makes
    // it both a discard candidate and a possible track-superset source.
    const graph = parseTitleGraph(
      loadFixture("soylent-green-uhd.robot.log"),
    )
    const rawStreamTitle = graph.titles.find(
      (title) => title.sourceFileName === "00425.m2ts",
    )

    expect(rawStreamTitle).toMatchObject({
      chapterCount: null,
      durationText: "1:36:48",
      segmentMap: [425],
    })
  })

  test("flags a segment map that makemkvcon truncated", () => {
    // Real output caps the field around 370 characters and ends it with
    // `...`, so a long playlist's map is a PREFIX. Any rule comparing
    // maps for identity must refuse to conclude "identical" here.
    const graph = parseTitleGraph(
      loadFixture("soylent-green-uhd.robot.log"),
    )
    const longPlaylist = graph.titles.find(
      (title) => title.sourceFileName === "00010.mpls",
    )

    expect(longPlaylist?.segmentCount).toBe(236)
    expect(longPlaylist?.isSegmentMapTruncated).toBe(true)
    expect(longPlaylist?.segmentMap.length).toBeLessThan(
      236,
    )
  })

  test("keeps the titles makemkvcon skipped, with the reason", () => {
    const graph = parseTitleGraph(
      loadFixture("desk-set-bluray.robot.log"),
    )

    expect(
      graph.skippedTitles.some(
        (skipped) => skipped.reason === "duplicate",
      ),
    ).toBe(true)
  })

  test("reports no key failure on a healthy capture", () => {
    const graph = parseTitleGraph(
      loadFixture("desk-set-bluray.robot.log"),
    )

    expect(graph.keyFailureMessages).toEqual([])
  })

  test("surfaces a key failure so it can outrank every other reason", () => {
    const graph = parseTitleGraph(
      [
        'MSG:1005,0,1,"MakeMKV v1.18.4 started","%1 started","x"',
        'MSG:5021,0,0,"This application version is too old","x"',
        "TCOUNT:0",
      ].join("\n"),
    )

    expect(graph.keyFailureMessages).toHaveLength(1)
    expect(graph.keyFailureMessages[0].code).toBe(5021)
  })
})
