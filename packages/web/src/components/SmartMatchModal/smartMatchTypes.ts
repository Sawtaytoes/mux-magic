// Narrow type mirrors of the server-side scorer types in
// `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts`.
// The web side imports these instead of the core package directly —
// same pattern used by `findNsfResults.ts` for the NSF summary shape —
// so unrelated server-side type changes don't ripple into web typecheck.
//
// Source of truth: the server. If you change one of these fields,
// change the matching field on the server type too.

export const LOW_CONFIDENCE_THRESHOLD = 0.6

// Worker 25: NSF auto-routes leftover files into
// `<sourcePath>/UNNAMED-FEATURES/` after the rename pass. The Smart
// Match modal builds its Apply `oldPath` against that bucket and
// renames the file back to `sourcePath` with the user-picked name in
// one /files/rename POST. The server's bucket constant lives at
// `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts`;
// kept here as a mirror so the web side doesn't take a core dep.
export const UNNAMED_FEATURES_BUCKET = "UNNAMED-FEATURES"

export type Candidate = {
  name: string
  timecode?: string
  parentName?: string
}

export type ScoredCandidate = {
  candidate: Candidate
  confidence: number
  durationScore: number
  filenameScore: number
}

export type FileSuggestion = {
  filename: string
  // File extension including the dot (e.g. ".mkv"). Empty string when
  // the file has none. Needed to rebuild the on-disk path for the
  // rename POST — the server's FileInfo.filename is already
  // extension-stripped via `getLastItemInFilePath`.
  extension: string
  durationSeconds: number | null
  rankedCandidates: ScoredCandidate[]
}

// Worker 7a: per-row mutable state stored alongside the suggestion.
// Exported so `plexExtraTypes.ts` helpers can reference the shape;
// the modal keeps the full `RowState` locally (which extends this).
export type SmartMatchRow = {
  // Worker 7a: Plex extra-type suffix selected for this row.
  // Empty string means "— no type —" (apply base name only).
  // One of the suffix values from PLEX_EXTRA_TYPES in plexExtraTypes.ts.
  plexSuffix: string
}
