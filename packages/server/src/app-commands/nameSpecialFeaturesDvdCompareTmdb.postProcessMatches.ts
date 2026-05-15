import type { FileInfo } from "@mux-magic/tools"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import type { Cut } from "../tools/parseSpecialFeatures.js"
import type { FileMatch } from "./nameSpecialFeaturesDvdCompareTmdb.fileMatch.js"
import {
  buildMovieBaseName,
  buildMovieFeatureName,
} from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"
import {
  MAIN_FEATURE_MIN_DURATION_SECONDS,
  timecodeToSeconds,
} from "./nameSpecialFeaturesDvdCompareTmdb.timecode.js"

// Produces the final {fileInfo, renamedFilename} pairs, applying movie
// naming to unmatched files when (and only when) no cut matched anything
// by timecode. The user's rule: if some cuts matched, the remaining
// unmatched files are likely unrelated extras DVDCompare didn't list, and
// renaming them as the main feature would be wrong.
export const postProcessMatches = (
  matches: FileMatch[],
  cuts: Cut[],
  movie: MovieIdentity,
): { fileInfo: FileInfo; renamedFilename: string }[] => {
  const renames: {
    fileInfo: FileInfo
    renamedFilename: string
  }[] = []
  const unmatched: FileMatch[] = []
  let hasAnyCutMatched = false

  matches.forEach((match) => {
    if (match.kind === "cut") {
      hasAnyCutMatched = true
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: buildMovieFeatureName(
          movie,
          match.cut.name,
        ),
      })
      return
    }
    if (match.kind === "extra") {
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: match.renamedFilename,
      })
      return
    }
    unmatched.push(match)
  })

  // Some cuts matched by timecode → the unmatched files probably aren't
  // main-feature candidates (DVDCompare's extras list might just be
  // incomplete). Leave them alone, same as today's behavior.
  if (hasAnyCutMatched) return renames

  // No cuts matched. Movie name not derivable means we can't rename
  // unmatched files as main features; leave them alone.
  if (!movie.title) return renames

  // Filter unmatched files to those long enough to plausibly be the
  // main feature. Image galleries, trailers, and other DVDCompare-
  // unlisted shorts come in well below 30 minutes; without this filter
  // a 3:31 image gallery would get renamed "(2) Movie (Year)" alongside
  // the actual movie. Files below the threshold stay unmatched and end
  // up in the unrenamedFilenames summary.
  const mainFeatureCandidates = unmatched.filter(
    (match) =>
      match.kind === "unmatched" &&
      timecodeToSeconds(match.timecode) >=
        MAIN_FEATURE_MIN_DURATION_SECONDS,
  )
  // Sort the candidates by filename so the (1)/(2) suffixes are stable
  // across runs.
  mainFeatureCandidates.sort((itemA, itemB) =>
    itemA.fileInfo.filename.localeCompare(
      itemB.fileInfo.filename,
    ),
  )

  if (mainFeatureCandidates.length === 0) return renames

  if (mainFeatureCandidates.length === 1) {
    // Single main-feature candidate → it's the movie. Use the sole-
    // named-cut's edition when DVDCompare published one (e.g.
    // "Director's Cut" without a timecode), else just `Title (Year)`.
    const soleNamedCut =
      cuts.length === 1 && cuts[0]?.name ? cuts[0] : null
    renames.push({
      fileInfo: mainFeatureCandidates[0].fileInfo,
      renamedFilename: buildMovieFeatureName(
        movie,
        soleNamedCut?.name ?? "",
      ),
    })
    return renames
  }

  // Multiple main-feature candidates, no timecode-driven disambiguation
  // → label each as "(1) Title (Year)", "(2) Title (Year)", … so the
  // user can tell at a glance they're the movie even if which-is-which
  // is ambiguous.
  const baseName = buildMovieBaseName(movie)
  mainFeatureCandidates.forEach((match, index) => {
    renames.push({
      fileInfo: match.fileInfo,
      renamedFilename: `(${index + 1}) ${baseName}`,
    })
  })
  return renames
}
