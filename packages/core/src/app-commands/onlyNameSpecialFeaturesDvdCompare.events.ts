// Per-file emission shape for the non-movie special-features pipeline.
// Narrower than the full NSF result: three variants —
//   { oldName, newName }   — successful in-place rename
//   { skippedFilename, reason }  — no timecode match; file left alone
//   { hasCollision, filename, targetFilename } — rename target already
//     exists on disk in interactive mode
//
// No summary trailer, no unnamed-file-candidate set, no edition-folder
// move, no TMDB lookup — those belong to the full
// `nameSpecialFeaturesDvdCompareTmdb` command (or the movie-cuts
// sibling). This command's only job is timecode-match + Plex-suffix
// rename; everything else is out of scope.
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
