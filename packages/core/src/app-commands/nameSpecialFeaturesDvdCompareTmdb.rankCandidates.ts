// Server-side ranker for the Smart Match (Fix Unnamed) flow.
//
// Ported verbatim from the original client-side
// `packages/web/src/components/SmartMatchModal/smartMatchScoring.ts`
// (worker 58) — moved here by worker 25 so the server emits already-
// ranked `ScoredCandidate[]` and the modal is a pure presenter. Algorithm
// and constants are unchanged; only the file location and the addition
// of `applyOrderBonus` (worker 25's order-based tie-break) are new.

import type {
  PossibleName,
  SpecialFeatureType,
} from "../tools/parseSpecialFeatures.js"

export const DURATION_PROXIMITY_TOLERANCE_SECONDS = 90
export const DURATION_WEIGHT = 0.7
export const FILENAME_ONLY_SCORE_FACTOR = 0.6
export const LOW_CONFIDENCE_THRESHOLD = 0.6
// Small enough to never override a real duration signal — it only breaks
// ties between equally-scored candidates by preferring the candidate
// whose DVDCompare-listing position matches the file's sorted-folder-
// listing position.
export const ORDER_BONUS = 0.05

export type Candidate = {
  name: string
  timecode?: string
  parentName?: string
  // Forwarded from `PossibleName` so the candidate builder can apply
  // the same `-trailer` / `-featurette` / `-behindthescenes` suffix
  // the main NSF rename flow appends. The scorer itself ignores these.
  type?: SpecialFeatureType
  parentType?: SpecialFeatureType
}

export type ScoredCandidate = {
  candidate: Candidate
  confidence: number
  durationScore: number
  filenameScore: number
}

export const parseTimecodeToSeconds = (
  timecode: string | undefined | null,
): number => {
  if (
    typeof timecode !== "string" ||
    timecode.length === 0
  ) {
    return NaN
  }
  const segments = timecode
    .split(":")
    .map((segment) => Number(segment))
  if (segments.some((segment) => Number.isNaN(segment))) {
    return NaN
  }
  if (segments.length === 1) {
    return segments[0]
  }
  if (segments.length === 2) {
    return segments[0] * 60 + segments[1]
  }
  if (segments.length === 3) {
    return (
      segments[0] * 3600 + segments[1] * 60 + segments[2]
    )
  }
  return NaN
}

const normalizeStem = (filename: string): string => {
  const dotIndex = filename.lastIndexOf(".")
  const stem =
    dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return stem.toLowerCase()
}

const tokenizeWords = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[\W_]+/u)
      .filter(Boolean),
  )

export const scoreFilenameOverlap = ({
  candidateName,
  filename,
}: {
  candidateName: string
  filename: string
}): number => {
  const candidateWords = Array.from(
    tokenizeWords(candidateName),
  )
  if (candidateWords.length === 0) {
    return 0
  }
  const stemWords = tokenizeWords(normalizeStem(filename))
  if (stemWords.size === 0) {
    return 0
  }
  const matchingWords = candidateWords.filter((word) =>
    stemWords.has(word),
  )
  return matchingWords.length / candidateWords.length
}

export const scoreDurationProximity = ({
  candidateTimecode,
  fileDurationSeconds,
}: {
  candidateTimecode: string | undefined | null
  fileDurationSeconds: number | null
}): number => {
  const candidateSeconds = parseTimecodeToSeconds(
    candidateTimecode,
  )
  if (
    Number.isNaN(candidateSeconds) ||
    fileDurationSeconds === null
  ) {
    return NaN
  }
  const deltaSeconds = Math.abs(
    candidateSeconds - fileDurationSeconds,
  )
  if (
    deltaSeconds >= DURATION_PROXIMITY_TOLERANCE_SECONDS
  ) {
    return 0
  }
  return (
    1 - deltaSeconds / DURATION_PROXIMITY_TOLERANCE_SECONDS
  )
}

export const combineScores = ({
  durationScore,
  filenameScore,
}: {
  durationScore: number
  filenameScore: number
}): number => {
  const hasDuration = !Number.isNaN(durationScore)
  const hasFilename = !Number.isNaN(filenameScore)
  if (!hasDuration && !hasFilename) {
    return 0
  }
  if (hasDuration && hasFilename) {
    return (
      DURATION_WEIGHT * durationScore +
      (1 - DURATION_WEIGHT) * filenameScore
    )
  }
  if (hasDuration) {
    return durationScore
  }
  return filenameScore * FILENAME_ONLY_SCORE_FACTOR
}

export const rankCandidatesForFile = ({
  fileDurationSeconds,
  filename,
  candidates,
}: {
  fileDurationSeconds: number | null
  filename: string
  candidates: Candidate[]
}): ScoredCandidate[] => {
  const scored = candidates.map((candidate) => {
    const filenameScore = scoreFilenameOverlap({
      candidateName: candidate.name,
      filename,
    })
    const durationScore = scoreDurationProximity({
      candidateTimecode: candidate.timecode,
      fileDurationSeconds,
    })
    const confidence = combineScores({
      durationScore,
      filenameScore,
    })
    return {
      candidate,
      confidence,
      durationScore,
      filenameScore,
    }
  })
  return scored.toSorted(
    (firstEntry, secondEntry) =>
      secondEntry.confidence - firstEntry.confidence,
  )
}

// Order-based tie-break: when a file at sorted-listing position
// `fileIndex` is ranked against DVDCompare candidates and one of those
// candidates sits at the same index in the published feature list,
// nudge that candidate's confidence by ORDER_BONUS and re-sort.
//
// The bonus is small (0.05) — well under the gap a real duration signal
// produces — so it only flips the order between candidates that were
// already neck-and-neck (e.g. two filename-only matches with identical
// word overlap).
export const applyOrderBonus = ({
  rankedCandidates,
  fileIndex,
  dvdCompareOrder,
}: {
  rankedCandidates: ScoredCandidate[]
  fileIndex: number
  dvdCompareOrder: string[]
}): ScoredCandidate[] => {
  if (
    fileIndex < 0 ||
    fileIndex >= dvdCompareOrder.length
  ) {
    return rankedCandidates
  }
  const expectedName = dvdCompareOrder[fileIndex]
  const adjusted = rankedCandidates.map((scored) =>
    scored.candidate.name === expectedName
      ? {
          ...scored,
          confidence: scored.confidence + ORDER_BONUS,
        }
      : scored,
  )
  return adjusted.toSorted(
    (firstEntry, secondEntry) =>
      secondEntry.confidence - firstEntry.confidence,
  )
}

// Convenience: convert a list of `PossibleName` (the type
// `parseSpecialFeatures` emits) into the `Candidate` shape this scorer
// expects. Kept thin so callers don't redo the field rename inline.
export const toCandidates = (
  possibleNames: PossibleName[],
): Candidate[] =>
  possibleNames.map((entry) => ({
    name: entry.name,
    timecode: entry.timecode,
    parentName: entry.parentName,
    type: entry.type,
    parentType: entry.parentType,
  }))
