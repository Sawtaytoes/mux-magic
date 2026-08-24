import { dirname } from "node:path"
import { describe, expect, test } from "vitest"

import {
  formatTrackPath,
  type TrackMetadata,
} from "./formatTrackPath.js"

const LIBRARY_ROOT = "/library"

const format = (metadata: TrackMetadata) =>
  formatTrackPath({
    libraryRoot: LIBRARY_ROOT,
    metadata,
    extension: ".flac",
  })

describe(`${formatTrackPath.name}: variable values lose the directory separator at substitution time, and each path segment is sanitized after the split`, () => {
  test("single-disc album", () => {
    expect(
      format({
        album: "Album Name",
        albumArtist: "Artist Name",
        artist: "Artist Name",
        discNumber: 1,
        title: "Track Title",
        totalDiscs: 1,
        trackNumber: 1,
      }),
    ).toBe(
      "/library/Artist Name/Album Name/01 Track Title.flac",
    )
  })

  test("multi-disc album, 2 to 9 discs", () => {
    expect(
      format({
        album: "Album Name",
        albumArtist: "Artist Name",
        artist: "Artist Name",
        discNumber: 1,
        title: "Track Title",
        totalDiscs: 2,
        trackNumber: 1,
      }),
    ).toBe(
      "/library/Artist Name/Album Name/1-01 Track Title.flac",
    )
  })

  test("multi-disc album, 10 or more discs", () => {
    expect(
      format({
        album: "Album Name",
        albumArtist: "Artist Name",
        artist: "Artist Name",
        discNumber: 1,
        title: "Track Title",
        totalDiscs: 12,
        trackNumber: 1,
      }),
    ).toBe(
      "/library/Artist Name/Album Name/01-01 Track Title.flac",
    )
  })

  test("compilation / various-artists release", () => {
    expect(
      format({
        album: "Album Name",
        albumArtist: "Various Artists",
        artist: "Track Artist",
        discNumber: 1,
        isMultiArtist: true,
        title: "Track Title",
        totalDiscs: 1,
        trackNumber: 1,
      }),
    ).toBe(
      "/library/Various Artists/Album Name/01 Track Artist - Track Title.flac",
    )
  })

  test("multi-disc compilation", () => {
    expect(
      format({
        album: "Album Name",
        albumArtist: "Various Artists",
        artist: "Track Artist",
        discNumber: 2,
        isMultiArtist: true,
        title: "Track Title",
        totalDiscs: 2,
        trackNumber: 5,
      }),
    ).toBe(
      "/library/Various Artists/Album Name/2-05 Track Artist - Track Title.flac",
    )
  })

  test("no album artist at all: no album folder and no track number", () => {
    expect(
      format({
        album: "Album Name",
        artist: "Track Artist",
        discNumber: 1,
        title: "Track Title",
        totalDiscs: 1,
        trackNumber: 1,
      }),
    ).toBe("/library/Track Artist/Track Title.flac")
  })
})

describe("the ways a re-implementation gets this wrong", () => {
  const singleDiscTrack = {
    album: "Album Name",
    albumArtist: "Artist Name",
    artist: "Artist Name",
    discNumber: 1,
    title: "Title",
    totalDiscs: 1,
    trackNumber: 1,
  }

  test("the separator after the track number is a space, not a dot or a hyphen", () => {
    const trackPath = format(singleDiscTrack)

    expect(trackPath).toBe(
      "/library/Artist Name/Album Name/01 Title.flac",
    )
    expect(trackPath).not.toContain("01. Title")
    expect(trackPath).not.toContain("01 - Title")
  })

  test("every disc of a multi-disc release lands in ONE album folder", () => {
    const discOnePath = format({
      album: "Album Name",
      albumArtist: "Artist Name",
      artist: "Artist Name",
      discNumber: 1,
      title: "First Title",
      totalDiscs: 2,
      trackNumber: 1,
    })
    const discTwoPath = format({
      album: "Album Name",
      albumArtist: "Artist Name",
      artist: "Artist Name",
      discNumber: 2,
      title: "Second Title",
      totalDiscs: 2,
      trackNumber: 1,
    })

    expect(dirname(discOnePath)).toBe(
      "/library/Artist Name/Album Name",
    )
    expect(dirname(discTwoPath)).toBe(dirname(discOnePath))
    expect(discOnePath).toBe(
      "/library/Artist Name/Album Name/1-01 First Title.flac",
    )
    expect(discTwoPath).toBe(
      "/library/Artist Name/Album Name/2-01 Second Title.flac",
    )
  })

  test("a slash, colon and question mark in a title become underscores and create no directory", () => {
    const trackPath = format({
      ...singleDiscTrack,
      title: "Who? Where: AC/DC",
    })

    expect(trackPath).toBe(
      "/library/Artist Name/Album Name/01 Who_ Where_ AC_DC.flac",
    )
    expect(dirname(trackPath)).toBe(
      "/library/Artist Name/Album Name",
    )
  })

  test("a slash in an artist name becomes an underscore and creates no directory", () => {
    const trackPath = format({
      ...singleDiscTrack,
      albumArtist: "AC/DC",
      artist: "AC/DC",
    })

    expect(trackPath).toBe(
      "/library/AC_DC/Album Name/01 Title.flac",
    )
  })

  test("a Japanese title survives unchanged", () => {
    expect(
      format({
        ...singleDiscTrack,
        album: "君の名は。",
        albumArtist: "RADWIMPS",
        artist: "RADWIMPS",
        title: "前前前世",
      }),
    ).toBe("/library/RADWIMPS/君の名は。/01 前前前世.flac")
  })
})

const FILE_NAME_PATTERN =
  /^(?:(\d+)-)?(\d+) (?:(.+) - )?(.+)\.flac$/

const parseTrackPath = ({
  trackPath,
  isMultiArtist,
  totalDiscs,
}: {
  trackPath: string
  isMultiArtist: boolean
  totalDiscs: number
}) =>
  ((segments: string[]) =>
    ((fileNameMatch: RegExpExecArray | null) =>
      fileNameMatch
        ? {
            album: segments[1] as string,
            albumArtist: segments[0] as string,
            artist:
              fileNameMatch[3] ?? (segments[0] as string),
            discNumber: fileNameMatch[1] ?? "1",
            isMultiArtist,
            title: fileNameMatch[4] as string,
            totalDiscs,
            trackNumber: fileNameMatch[2] as string,
          }
        : null)(
      FILE_NAME_PATTERN.exec(segments[2] as string),
    ))(trackPath.slice(LIBRARY_ROOT.length + 1).split("/"))

describe("idempotence", () => {
  test.each([
    {
      isMultiArtist: false,
      name: "single-disc album",
      totalDiscs: 1,
      metadata: {
        album: "Album Name",
        albumArtist: "Artist Name",
        artist: "Artist Name",
        discNumber: 1,
        title: "Track Title",
        totalDiscs: 1,
        trackNumber: 1,
      },
    },
    {
      isMultiArtist: true,
      name: "multi-disc compilation",
      totalDiscs: 2,
      metadata: {
        album: "Album Name",
        albumArtist: "Various Artists",
        artist: "Track Artist",
        discNumber: 2,
        isMultiArtist: true,
        title: "Track Title",
        totalDiscs: 2,
        trackNumber: 5,
      },
    },
  ])("re-formatting the parsed path reproduces it exactly: $name", ({
    isMultiArtist,
    metadata,
    totalDiscs,
  }) => {
    const firstPath = format(metadata)
    const reparsedMetadata = parseTrackPath({
      trackPath: firstPath,
      isMultiArtist,
      totalDiscs,
    })

    expect(reparsedMetadata).not.toBeNull()
    expect(format(reparsedMetadata as TrackMetadata)).toBe(
      firstPath,
    )
  })
})
