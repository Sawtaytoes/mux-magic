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
  durationSeconds: number | null
}

export const buildUnnamedFileCandidates = ({
  possibleNames,
  unrenamedFiles,
}: {
  possibleNames: PossibleName[]
  unrenamedFiles: UnrenamedFile[]
}): UnnamedFileCandidate[] => {
  if (
    unrenamedFiles.length === 0 ||
    possibleNames.length === 0
  ) {
    return []
  }

  return unrenamedFiles.map(
    ({ filename, durationSeconds }) => {
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
      const ranked = scored.toSorted(
        (firstEntry, secondEntry) =>
          secondEntry.overlap - firstEntry.overlap,
      )

      return {
        filename,
        durationSeconds,
        candidates: ranked.map(
          (entry) => entry.candidate.name,
        ),
      }
    },
  )
}
