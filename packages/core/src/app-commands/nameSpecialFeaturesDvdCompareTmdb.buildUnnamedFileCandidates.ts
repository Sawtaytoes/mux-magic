import type { PossibleName } from "../tools/parseSpecialFeatures.js"
import type { UnnamedFileCandidate } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"
import { stripExtension } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"

// Build a follow-up association report for unnamed files. Each unnamed
// file is paired with a ranked list of DVDCompare untimed suggestions
// (possibleNames) that could correspond to it. Ranking is shared-word
// overlap — a cheap heuristic that surfaces the right candidate in most
// real-world cases ("MOVIE_t23.mkv" vs. "Image Gallery (1200 images)").
// The web-side Smart Match modal (worker 58 / Part B) layers a richer
// duration-proximity ranker on top of this list using the
// `durationSeconds` carried per file; worker 25 moves that richer
// ranking server-side.
export type UnrenamedFile = {
  filename: string
  // File extension including the dot (e.g. ".mkv"). See
  // `UnnamedFileCandidate.extension` for rationale — the Smart Match
  // modal needs the extension to build the on-disk path for the
  // rename POST without it the rename fails ENOENT.
  extension: string
  durationSeconds: number | null
}

export const buildUnnamedFileCandidates = ({
  possibleNames,
  unrenamedFiles,
}: {
  possibleNames: PossibleName[]
  unrenamedFiles: UnrenamedFile[]
}): UnnamedFileCandidate[] => {
  if (unrenamedFiles.length === 0) {
    return []
  }
  // No DVDCompare candidates means there's nothing to rank — but the
  // leftover files still need a UI surface so the user can rename them
  // manually. Emit one entry per file with an empty candidates list so
  // the Smart Match modal opens with the filenames visible even when
  // every DVDCompare extra had a timecode (no untimed `possibleNames`).
  if (possibleNames.length === 0) {
    return unrenamedFiles.map(
      ({ filename, extension, durationSeconds }) => ({
        filename,
        extension,
        durationSeconds,
        candidates: [],
      }),
    )
  }

  return unrenamedFiles.map(
    ({ filename, extension, durationSeconds }) => {
      const stem = stripExtension(filename).toLowerCase()
      const stemWords = new Set(
        stem.split(/[\W_]+/).filter(Boolean),
      )

      const scored = possibleNames.map((candidate) => {
        const candidateWords = candidate.name
          .toLowerCase()
          .split(/[\W_]+/)
          .filter(Boolean)
        const overlap = candidateWords.filter((word) =>
          stemWords.has(word),
        ).length
        return { candidate, overlap }
      })
      // `.toSorted()` returns a fresh sorted array — preserves the "no
      // array mutation" rule from AGENTS.md while keeping ties stable.
      //
      // Heads-up to the next reader: this server-side word-overlap
      // ranking is largely redundant with the client's
      // `smartMatchScoring.rankSuggestions`, which re-ranks the same
      // list with a duration-weighted scorer and ignores input order.
      // The only benefit today is that callers without the Smart Match
      // modal (CLI / JSON consumers) still get a sensible top pick.
      // Worker 25 (`nsf-fix-unnamed-overhaul`) moves the richer
      // duration-weighted scorer server-side, at which point this
      // overlap pass should be removed — not extended.
      const ranked = scored.toSorted(
        (firstEntry, secondEntry) =>
          secondEntry.overlap - firstEntry.overlap,
      )

      return {
        filename,
        extension,
        durationSeconds,
        candidates: ranked.map(
          (entry) => entry.candidate.name,
        ),
      }
    },
  )
}
