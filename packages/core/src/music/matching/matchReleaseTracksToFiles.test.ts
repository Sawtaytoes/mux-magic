import { describe, expect, test } from "vitest"

import {
  matchReleaseTracksToFiles,
  type ReleaseTrackForMatching,
  scoreTrackAgainstFile,
} from "./matchReleaseTracksToFiles.js"

const buildTrack = (
  overrides: Partial<ReleaseTrackForMatching> = {},
): ReleaseTrackForMatching => ({
  discNumber: 1,
  lengthMilliseconds: 210_000,
  position: 1,
  title: "Bring the Noise",
  ...overrides,
})

describe(scoreTrackAgainstFile.name, () => {
  test("a file agreeing on title, duration and position scores 1", () => {
    expect(
      scoreTrackAgainstFile({
        file: {
          durationSeconds: 210,
          filePath: "/inbox/01.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        track: buildTrack(),
      }),
    ).toBe(1)
  })

  test("a missing title is not scored against the file, so the remaining signals decide it", () => {
    expect(
      scoreTrackAgainstFile({
        file: {
          durationSeconds: 210,
          filePath: "/inbox/01.flac",
          trackNumber: 1,
        },
        track: buildTrack(),
      }),
    ).toBe(1)
  })

  test("a file with no tags at all scores 0 rather than NaN", () => {
    expect(
      scoreTrackAgainstFile({
        file: { filePath: "/inbox/01.flac" },
        track: buildTrack(),
      }),
    ).toBe(0)
  })

  test("a disc number that disagrees with the medium zeroes the position signal", () => {
    expect(
      scoreTrackAgainstFile({
        file: {
          discNumber: 2,
          filePath: "/inbox/01.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        track: buildTrack({ discNumber: 1 }),
      }),
    ).toBeLessThan(
      scoreTrackAgainstFile({
        file: {
          discNumber: 1,
          filePath: "/inbox/01.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        track: buildTrack({ discNumber: 1 }),
      }),
    )
  })

  test("a duration under two seconds apart is not penalised at all", () => {
    expect(
      scoreTrackAgainstFile({
        file: {
          durationSeconds: 211.5,
          filePath: "/inbox/01.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        track: buildTrack({ lengthMilliseconds: 210_000 }),
      }),
    ).toBe(1)
  })
})

describe(matchReleaseTracksToFiles.name, () => {
  test("each file takes its own track, and no track is used twice", () => {
    const matches = matchReleaseTracksToFiles({
      files: [
        {
          durationSeconds: 210,
          filePath: "/inbox/01.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        {
          durationSeconds: 180,
          filePath: "/inbox/02.flac",
          title: "Don't Believe the Hype",
          trackNumber: 2,
        },
      ],
      tracks: [
        buildTrack(),
        buildTrack({
          lengthMilliseconds: 180_000,
          position: 2,
          title: "Don't Believe the Hype",
        }),
      ],
    })

    expect(
      matches.map((match) => [
        match.filePath,
        match.track?.position,
      ]),
    ).toEqual([
      ["/inbox/01.flac", 1],
      ["/inbox/02.flac", 2],
    ])
  })

  test("a track number that lies is overruled by the title and the duration", () => {
    const matches = matchReleaseTracksToFiles({
      files: [
        {
          durationSeconds: 180,
          filePath: "/inbox/a.flac",
          title: "Don't Believe the Hype",
          trackNumber: 1,
        },
      ],
      tracks: [
        buildTrack(),
        buildTrack({
          lengthMilliseconds: 180_000,
          position: 2,
          title: "Don't Believe the Hype",
        }),
      ],
    })

    expect(matches[0].track?.position).toBe(2)
  })

  test("a file that matches nothing well enough comes back unmatched, not wrongly matched", () => {
    const matches = matchReleaseTracksToFiles({
      files: [
        {
          durationSeconds: 900,
          filePath: "/inbox/interview.flac",
          title: "Studio Interview 1987",
          trackNumber: 99,
        },
      ],
      tracks: [buildTrack()],
    })

    expect(matches).toEqual([
      {
        filePath: "/inbox/interview.flac",
        matchConfidence: 0,
        track: null,
      },
    ])
  })

  test("two files cannot claim the same track — the weaker one is left unmatched", () => {
    const matches = matchReleaseTracksToFiles({
      files: [
        {
          durationSeconds: 210,
          filePath: "/inbox/a.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
        {
          durationSeconds: 240,
          filePath: "/inbox/b.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
      ],
      tracks: [buildTrack()],
    })

    expect(
      matches.filter((match) => match.track !== null),
    ).toHaveLength(1)
    expect(
      matches.find(
        (match) => match.filePath === "/inbox/a.flac",
      )?.track?.position,
    ).toBe(1)
  })

  test("a multi-disc release keeps disc 2 files on disc 2", () => {
    const matches = matchReleaseTracksToFiles({
      files: [
        {
          discNumber: 2,
          durationSeconds: 210,
          filePath: "/inbox/d2t1.flac",
          title: "Bring the Noise",
          trackNumber: 1,
        },
      ],
      tracks: [
        buildTrack({ discNumber: 1 }),
        buildTrack({ discNumber: 2 }),
      ],
    })

    expect(matches[0].track?.discNumber).toBe(2)
  })

  test("the same inputs produce the same assignment twice", () => {
    const files = [
      {
        durationSeconds: 210,
        filePath: "/inbox/a.flac",
        title: "Bring the Noise",
      },
      {
        durationSeconds: 210,
        filePath: "/inbox/b.flac",
        title: "Bring the Noise",
      },
    ]
    const tracks = [
      buildTrack({ position: 1 }),
      buildTrack({ position: 2 }),
    ]

    expect(
      matchReleaseTracksToFiles({ files, tracks }),
    ).toEqual(matchReleaseTracksToFiles({ files, tracks }))
  })
})
