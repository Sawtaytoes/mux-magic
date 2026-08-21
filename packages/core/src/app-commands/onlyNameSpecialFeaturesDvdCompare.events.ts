import type { PossibleName } from "../tools/parseSpecialFeatures.js"
import type { UnnamedFileCandidate } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"

// Per-file emission shape for the non-movie special-features pipeline.
// Narrower than the full NSF result: four variants —
//   { oldName, newName }   — successful in-place rename
//   { skippedFilename, reason }  — no timecode match; file left alone
//   { hasCollision, filename, targetFilename } — rename target already
//     exists on disk in interactive mode
//   the summary trailer — one per run, emitted last (below)
//
// Still no edition-folder move and no TMDB lookup: those belong to the
// full `nameSpecialFeaturesDvdCompareTmdb` command (or the movie-cuts
// sibling). This command's job is timecode-match + Plex-suffix rename.
//
// The summary trailer is deliberately the *same* shape the TMDB sibling
// emits, because the web's NSF results panel identifies it structurally
// (`isNsfSummary` in `findNsfResults.ts` — an `unrenamedFilenames` array
// plus a `possibleNames` array) rather than by command name. Matching
// the shape is what makes "Files not renamed: N" and the ✨ Fix Unnamed
// button light up for this command with no UI change at all. The
// original spec left leftovers as skip-with-log only, which meant the
// no-TMDB variant had no way to name them from the UI even though the
// DVDCompare candidate list was right there.
//
// `allKnownNames` carries every extras label in DVDCompare order for the
// interactive renamer's autocomplete. There is no `cuts` contribution
// here — cuts are the movie-naming branch this command doesn't run.
export type OnlyNameSpecialFeaturesSummary = {
  unrenamedFilenames: string[]
  possibleNames: PossibleName[]
  allKnownNames: string[]
  unnamedFileCandidates: UnnamedFileCandidate[]
}

export type OnlyNameSpecialFeaturesResult =
  | { oldName: string; newName: string }
  | {
      skippedFilename: string
      reason: "no_extra_match"
    }
  | {
      hasCollision: true
      filename: string
      targetFilename: string
    }
  | OnlyNameSpecialFeaturesSummary
