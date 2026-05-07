import { describe, expect, test } from "vitest"

import type { Cut } from "../tools/parseSpecialFeatures.js"
import type { FileInfo } from "../tools/getFiles.js"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"

import {
  buildMovieBaseName,
  buildMovieFeatureName,
  findMatchingCut,
  postProcessMatches,
  reorderRenamesForOnDiskConflicts,
  type FileMatch,
} from "./nameSpecialFeatures.js"

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  // The post-processor never invokes renameFile in tests; stub returns
  // an Observable<void> so the type matches.
  renameFile: () => ({} as ReturnType<FileInfo["renameFile"]>),
})

// Default to a movie-length timecode so unmatched-fallback tests
// reflect the "obviously the movie" case. Tests that exercise the
// under-threshold filter pass an explicit short timecode.
const MOVIE_LENGTH_TIMECODE = "1:30:00"

describe(buildMovieBaseName.name, () => {
  test("formats 'Title (Year)' for a normal entry", () => {
    expect(buildMovieBaseName({ title: "Inception", year: "2010" }))
    .toBe("Inception (2010)")
  })

  test("drops the year parenthetical when missing", () => {
    expect(buildMovieBaseName({ title: "Untitled", year: "" }))
    .toBe("Untitled")
  })

  test("strips filename-illegal characters from the title", () => {
    expect(buildMovieBaseName({ title: "Soldier: Reloaded?", year: "1998" }))
    .toBe("Soldier - Reloaded (1998)")
  })
})

describe(buildMovieFeatureName.name, () => {
  test("appends '{edition-…}' when a cut name is provided", () => {
    expect(buildMovieFeatureName({ title: "Dragon Lord", year: "1982" }, "Hong Kong Version"))
    .toBe("Dragon Lord (1982) {edition-Hong Kong Version}")
  })

  test("omits the edition suffix for an empty cut name", () => {
    expect(buildMovieFeatureName({ title: "Dragon Lord", year: "1982" }, ""))
    .toBe("Dragon Lord (1982)")
  })
})

describe(findMatchingCut.name, () => {
  test("returns null when no cut has a timecode close to the file's", () => {
    const cuts: Cut[] = [{ name: "Hong Kong", timecode: "1:36:06" }]
    expect(findMatchingCut(cuts, "0:45:12", {})).toBeNull()
  })

  test("finds a cut whose timecode matches within the configured deviation window", () => {
    const cuts: Cut[] = [{ name: "Hybrid", timecode: "1:48:44" }]
    expect(findMatchingCut(cuts, "1:48:44", {})).toEqual({ name: "Hybrid", timecode: "1:48:44" })
  })

  test("ignores cuts that have no timecode (can't match by timecode if there isn't one)", () => {
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    expect(findMatchingCut(cuts, "1:54:42", {})).toBeNull()
  })

  test("uses a wider built-in window than extras so typical 5-10s rip drift still matches", () => {
    // Real-world deltas observed on a Dragon Lord 4K rip:
    // file 1:43:09 vs DVDCompare's Extended Version 1:43:02 → 7s off.
    // The default deviation passed in by the route is { padding: 2 }
    // (from the schema), but findMatchingCut bumps that to its
    // built-in floor (15s) for cut matching.
    const cuts: Cut[] = [
      { name: "Hong Kong Version", timecode: "1:36:06" },
      { name: "English Export Version", timecode: "1:30:50" },
      { name: "Extended Version", timecode: "1:43:02" },
      { name: "Hybrid Version", timecode: "1:48:44" },
    ]
    expect(findMatchingCut(cuts, "1:43:09", { timecodePaddingAmount: 2 }))
    .toEqual({ name: "Extended Version", timecode: "1:43:02" })
    expect(findMatchingCut(cuts, "1:30:54", { timecodePaddingAmount: 2 }))
    .toEqual({ name: "English Export Version", timecode: "1:30:50" })
  })

  test("an explicit larger padding from the caller still wins (Math.max with the floor)", () => {
    const cuts: Cut[] = [{ name: "Anniversary", timecode: "2:00:00" }]
    // The 30s explicit padding catches a 25s drift even though that's
    // beyond the 15s built-in floor.
    expect(findMatchingCut(cuts, "1:59:35", { timecodePaddingAmount: 30 }))
    .toEqual({ name: "Anniversary", timecode: "2:00:00" })
  })
})

describe(postProcessMatches.name, () => {
  const movie: MovieIdentity = { title: "Dragon Lord", year: "1982" }

  test("renames cut-matched files as 'Title (Year) {edition-…}'", () => {
    const matches: FileMatch[] = [
      { kind: "cut", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc1.mkv"), cut: { name: "Hong Kong Version", timecode: "1:36:06" } },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Hong Kong Version}" },
    ])
  })

  test("passes 'extra' renames through unchanged", () => {
    const matches: FileMatch[] = [
      { kind: "extra", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("clip.mkv"), renamedFilename: "Behind the Scenes -behindthescenes" },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Behind the Scenes -behindthescenes" },
    ])
  })

  test("leaves unmatched files alone when at least one cut matched (extras list is likely incomplete)", () => {
    const matches: FileMatch[] = [
      { kind: "cut", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("a.mkv"), cut: { name: "Director's Cut", timecode: "1:54:42" } },
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("b.mkv") },
    ]
    expect(postProcessMatches(matches, [{ name: "Director's Cut", timecode: "1:54:42" }], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Director's Cut}" },
    ])
  })

  test("renames a single unmatched file as 'Title (Year)' when no cuts matched", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("rip.mkv") },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982)" },
    ])
  })

  test("uses the sole-named-cut's edition when there's exactly one cut and one unmatched file", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("rip.mkv") },
    ]
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    expect(postProcessMatches(matches, cuts, movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Director's Cut}" },
    ])
  })

  test("falls back to '(1)/(2)' counter prefixes for multiple unmatched files", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc1.mkv") },
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc2.mkv") },
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc3.mkv") },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "(1) Dragon Lord (1982)" },
      { fileInfo: matches[1].fileInfo, renamedFilename: "(2) Dragon Lord (1982)" },
      { fileInfo: matches[2].fileInfo, renamedFilename: "(3) Dragon Lord (1982)" },
    ])
  })

  test("sorts unmatched files by filename so '(1)/(2)' assignment is deterministic", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("z-disc.mkv") },
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("a-disc.mkv") },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(result.map((rename) => rename.renamedFilename)).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("a-disc.mkv")
    expect(result[1].fileInfo.filename).toBe("z-disc.mkv")
  })

  test("leaves unmatched files alone when there's no movie title to apply", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("rip.mkv") },
    ]
    expect(postProcessMatches(matches, [], { title: "", year: "" })).toEqual([])
  })

  test("excludes short unmatched files (e.g. an image gallery) from the main-feature fallback", () => {
    // Reproduces the user's reported bug: a 3:31 image gallery was
    // getting renamed "(2) Soldier (1998)" alongside the actual movie
    // because both fell through to the unmatched-as-main-feature branch.
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: "1:42:00", fileInfo: makeFileInfo("movie.mkv") },
      { kind: "unmatched", timecode: "3:31",    fileInfo: makeFileInfo("image-gallery.mkv") },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(result.map((rename) => rename.renamedFilename)).toEqual([
      // Only the over-threshold file gets renamed; (1)/(2) pluralization
      // doesn't fire because there's now only one main-feature candidate.
      "Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("movie.mkv")
  })

  test("falls through to the (1)/(2) prefix when multiple unmatched files all clear the duration threshold", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: "1:36:00", fileInfo: makeFileInfo("disc-a.mkv") },
      { kind: "unmatched", timecode: "1:48:00", fileInfo: makeFileInfo("disc-b.mkv") },
      { kind: "unmatched", timecode: "0:08:00", fileInfo: makeFileInfo("trailer.mkv") },
    ]
    const result = postProcessMatches(matches, [], movie)
    // The trailer is below threshold and stays unrenamed; the two
    // movie-length files get the counter prefix.
    expect(result.map((r) => ({ filename: r.fileInfo.filename, renamed: r.renamedFilename }))).toEqual([
      { filename: "disc-a.mkv", renamed: "(1) Dragon Lord (1982)" },
      { filename: "disc-b.mkv", renamed: "(2) Dragon Lord (1982)" },
    ])
  })

  test("does NOT pick up the sole-named-cut's edition when multiple unmatched files would all need it (ambiguous)", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc1.mkv") },
      { kind: "unmatched", timecode: MOVIE_LENGTH_TIMECODE, fileInfo: makeFileInfo("disc2.mkv") },
    ]
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    // Two files claiming the same edition would be wrong — fall back to
    // counter prefixes without an edition tag.
    expect(postProcessMatches(matches, cuts, movie).map((r) => r.renamedFilename)).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
  })
})

describe(reorderRenamesForOnDiskConflicts.name, () => {
  test("leaves the order untouched when no rename targets another file's current name", () => {
    const renames = [
      { fileInfo: makeFileInfo("MOVIE_t01.mkv"), renamedFilename: "Soldier (1998)" },
      { fileInfo: makeFileInfo("MOVIE_t02.mkv"), renamedFilename: "Behind the Scenes -behindthescenes" },
    ]
    expect(reorderRenamesForOnDiskConflicts(renames)).toEqual(renames)
  })

  test("defers a rename whose target equals another rename's current filename (extension-stripped)", () => {
    // Reproduces the SOLDIER 4K race: a prior partial run left
    // "International Trailer without Narration -trailer.mkv" on disk;
    // this run renames that file to "with Narration" AND another file
    // to "without Narration". With concurrency >= 2 they raced; the
    // reorder ensures the file-renaming-away goes first.
    const renames = [
      // Conflicting rename — its target equals another rename's source
      { fileInfo: makeFileInfo("MOVIE_t12.mkv"), renamedFilename: "International Trailer without Narration -trailer" },
      // The file currently holding that name — needs to renaming first
      { fileInfo: makeFileInfo("International Trailer without Narration -trailer.mkv"), renamedFilename: "International Trailer with Narration -trailer" },
      { fileInfo: makeFileInfo("MOVIE_t05.mkv"), renamedFilename: "Featurette -featurette" },
    ]
    expect(reorderRenamesForOnDiskConflicts(renames).map((r) => r.fileInfo.filename))
    .toEqual([
      // Non-conflicting renames first
      "International Trailer without Narration -trailer.mkv",
      "MOVIE_t05.mkv",
      // Then the deferred conflicting rename
      "MOVIE_t12.mkv",
    ])
  })

  test("keeps an idempotent rename (target equals own current name) in the upfront group", () => {
    // A file whose target is its own name shouldn't be flagged as
    // conflicting with itself — the sourceStems set includes it, but
    // we explicitly skip the self-match.
    const renames = [
      { fileInfo: makeFileInfo("Already Named.mkv"), renamedFilename: "Already Named" },
    ]
    expect(reorderRenamesForOnDiskConflicts(renames)).toEqual(renames)
  })
})
