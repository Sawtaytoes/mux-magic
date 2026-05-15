import type { PossibleName } from "../tools/parseSpecialFeatures.js"
import type { UnnamedFileCandidate } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"
import { stripExtension } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"

// Build a follow-up association report for unnamed files. Each unnamed
// file is paired with a ranked list of DVDCompare untimed suggestions
// (possibleNames) that could correspond to it. Right now the ranking is
// lexicographic similarity (shared words) — a cheap heuristic that still
// surfaces the right candidate in most real-world cases (the file might
// be named something like "MOVIE_t23.mkv" while the suggestion is
// "Image Gallery (1200 images)"). Callers that want more signals (runtime
// proximity) can extend this later.
export const buildUnnamedFileCandidates = ({
  possibleNames,
  unrenamedFilenames,
}: {
  possibleNames: PossibleName[]
  unrenamedFilenames: string[]
}): UnnamedFileCandidate[] => {
  if (
    unrenamedFilenames.length === 0 ||
    possibleNames.length === 0
  ) {
    return []
  }

  return unrenamedFilenames.map((filename) => {
    const stem = stripExtension(filename).toLowerCase()
    const stemWords = new Set(
      stem.split(/[\W_]+/).filter(Boolean),
    )

    // Score each candidate by how many of its words appear in the stem.
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
    // Sort descending by overlap; ties preserve original order.
    scored.sort(
      (firstEntry, secondEntry) =>
        secondEntry.overlap - firstEntry.overlap,
    )

    return {
      filename,
      candidates: scored.map(
        (entry) => entry.candidate.name,
      ),
    }
  })
}
