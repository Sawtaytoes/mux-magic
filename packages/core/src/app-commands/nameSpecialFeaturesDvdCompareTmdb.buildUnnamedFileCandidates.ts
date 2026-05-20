import type { PossibleName } from "../tools/parseSpecialFeatures.js"
import type { UnnamedFileCandidate } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"
import {
  applyOrderBonus,
  rankCandidatesForFile,
  toCandidates,
} from "./nameSpecialFeaturesDvdCompareTmdb.rankCandidates.js"

// Build a follow-up association report for unnamed files. Each entry
// carries a duration-weighted ranked candidate list (the same scorer
// the Smart Match modal used to compute client-side — worker 25 moved
// it server-side) plus worker 25's order-based tie-break: when a file
// at sorted-listing position N is ranked against DVDCompare candidates
// and one of those candidates sits at position N in the published
// feature list, that candidate gets a small ORDER_BONUS nudge.
export type UnrenamedFile = {
  filename: string
  // File extension including the dot (e.g. ".mkv"). See
  // `UnnamedFileCandidate.extension` for rationale — the Smart Match
  // modal needs the extension to build the on-disk path for the
  // rename POST.
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
  // No DVDCompare candidates — emit one entry per file with an empty
  // ranked list so the Smart Match modal still opens with the leftover
  // filenames visible (the user can rename manually). This is the
  // every-extra-has-a-timecode case (e.g. the Shrek 2 DVDCompare page).
  if (possibleNames.length === 0) {
    return unrenamedFiles.map(
      ({ filename, extension, durationSeconds }) => ({
        filename,
        extension,
        durationSeconds,
        rankedCandidates: [],
      }),
    )
  }

  const candidates = toCandidates(possibleNames)
  const dvdCompareOrder = possibleNames.map(
    (entry) => entry.name,
  )

  return unrenamedFiles.map(
    (
      { filename, extension, durationSeconds },
      fileIndex,
    ) => {
      const ranked = rankCandidatesForFile({
        candidates,
        fileDurationSeconds: durationSeconds,
        filename,
      })
      const rankedCandidates = applyOrderBonus({
        rankedCandidates: ranked,
        fileIndex,
        dvdCompareOrder,
      })
      return {
        filename,
        extension,
        durationSeconds,
        rankedCandidates,
      }
    },
  )
}
