import type { FileInfo } from "@mux-magic/tools"
import { describe, expect, test } from "vitest"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import type { Cut } from "../tools/parseSpecialFeatures.js"
import type { FileMatch } from "./nameSpecialFeaturesDvdCompareTmdb.fileMatch.js"
import { postProcessMatches } from "./nameSpecialFeaturesDvdCompareTmdb.postProcessMatches.js"

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  // The post-processor never invokes renameFile in tests; stub returns
  // an Observable<void> so the type matches.
  renameFile: () =>
    ({}) as ReturnType<FileInfo["renameFile"]>,
})

// Default to a movie-length timecode so unmatched-fallback tests
// reflect the "obviously the movie" case. Tests that exercise the
// under-threshold filter pass an explicit short timecode.
const MOVIE_LENGTH_TIMECODE = "1:30:00"

describe(postProcessMatches.name, () => {
  const movie: MovieIdentity = {
    title: "Dragon Lord",
    year: "1982",
  }

  test("renames cut-matched files as 'Title (Year) {edition-…}'", () => {
    const matches: FileMatch[] = [
      {
        kind: "cut",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
        cut: {
          name: "Hong Kong Version",
          timecode: "1:36:06",
        },
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}",
      },
    ])
  })

  test("passes 'extra' renames through unchanged", () => {
    const matches: FileMatch[] = [
      {
        kind: "extra",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("clip.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ])
  })

  test("leaves unmatched files alone when at least one cut matched (extras list is likely incomplete)", () => {
    const matches: FileMatch[] = [
      {
        kind: "cut",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("a.mkv"),
        cut: {
          name: "Director's Cut",
          timecode: "1:54:42",
        },
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("b.mkv"),
      },
    ]
    expect(
      postProcessMatches(
        matches,
        [{ name: "Director's Cut", timecode: "1:54:42" }],
        movie,
      ),
    ).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Director's Cut}",
      },
    ])
  })

  test("renames a single unmatched file as 'Title (Year)' when no cuts matched", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename: "Dragon Lord (1982)",
      },
    ])
  })

  test("uses the sole-named-cut's edition when there's exactly one cut and one unmatched file", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    const cuts: Cut[] = [
      { name: "Director's Cut", timecode: undefined },
    ]
    expect(
      postProcessMatches(matches, cuts, movie),
    ).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Director's Cut}",
      },
    ])
  })

  test("falls back to '(1)/(2)' counter prefixes for multiple unmatched files", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc2.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc3.mkv"),
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename: "(1) Dragon Lord (1982)",
      },
      {
        fileInfo: matches[1].fileInfo,
        renamedFilename: "(2) Dragon Lord (1982)",
      },
      {
        fileInfo: matches[2].fileInfo,
        renamedFilename: "(3) Dragon Lord (1982)",
      },
    ])
  })

  test("sorts unmatched files by filename so '(1)/(2)' assignment is deterministic", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("z-disc.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("a-disc.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(
      result.map((rename) => rename.renamedFilename),
    ).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("a-disc.mkv")
    expect(result[1].fileInfo.filename).toBe("z-disc.mkv")
  })

  test("leaves unmatched files alone when there's no movie title to apply", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    expect(
      postProcessMatches(matches, [], {
        title: "",
        year: "",
      }),
    ).toEqual([])
  })

  test("excludes short unmatched files (e.g. an image gallery) from the main-feature fallback", () => {
    // Reproduces the user's reported bug: a 3:31 image gallery was
    // getting renamed "(2) Soldier (1998)" alongside the actual movie
    // because both fell through to the unmatched-as-main-feature branch.
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: "1:42:00",
        fileInfo: makeFileInfo("movie.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "3:31",
        fileInfo: makeFileInfo("image-gallery.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(
      result.map((rename) => rename.renamedFilename),
    ).toEqual([
      // Only the over-threshold file gets renamed; (1)/(2) pluralization
      // doesn't fire because there's now only one main-feature candidate.
      "Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("movie.mkv")
  })

  test("falls through to the (1)/(2) prefix when multiple unmatched files all clear the duration threshold", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: "1:36:00",
        fileInfo: makeFileInfo("disc-a.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "1:48:00",
        fileInfo: makeFileInfo("disc-b.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "0:08:00",
        fileInfo: makeFileInfo("trailer.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    // The trailer is below threshold and stays unrenamed; the two
    // movie-length files get the counter prefix.
    expect(
      result.map((rename) => ({
        filename: rename.fileInfo.filename,
        renamed: rename.renamedFilename,
      })),
    ).toEqual([
      {
        filename: "disc-a.mkv",
        renamed: "(1) Dragon Lord (1982)",
      },
      {
        filename: "disc-b.mkv",
        renamed: "(2) Dragon Lord (1982)",
      },
    ])
  })

  test("does NOT pick up the sole-named-cut's edition when multiple unmatched files would all need it (ambiguous)", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc2.mkv"),
      },
    ]
    const cuts: Cut[] = [
      { name: "Director's Cut", timecode: undefined },
    ]
    // Two files claiming the same edition would be wrong — fall back to
    // counter prefixes without an edition tag.
    expect(
      postProcessMatches(matches, cuts, movie).map(
        (rename) => rename.renamedFilename,
      ),
    ).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
  })
})
