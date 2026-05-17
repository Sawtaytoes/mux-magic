// Smart-suggestion ranker for the Smart Match (Fix Unnamed) modal.
// Pure functions — no DOM, no React, no atoms. Direct port of the
// legacy `packages/web/public/builder/js/util/specials-fuzzy.js`
// (commit 28534ec5^) with two adaptations:
//   1. File-side input changed from `timecode?: string` to
//      `durationSeconds: number | null` so the modal can consume the
//      worker-58 server payload directly without re-parsing timecodes.
//   2. In-place `.sort()` replaced with `.toSorted()` per the repo's
//      "no array mutation" rule.
//
// Two scoring signals:
//   1. Duration proximity — when a candidate has a `timecode` AND the
//      file has a runtime, score by how close the two are. A 0-second
//      delta scores 1.0; deltas above DURATION_PROXIMITY_TOLERANCE_SECONDS
//      degrade linearly to 0.
//   2. Filename similarity — shared-word overlap between the file's
//      stem and the candidate label, normalized by candidate-word count.
//
// When BOTH signals are available the combined score is a weighted blend
// (duration weighs heavier — file runtime is a much stronger signal than
// fuzzy filename overlap when DVDCompare published a runtime). When only
// filename signal is available the score degrades to filename-only with
// a small penalty (multiplied by FILENAME_ONLY_SCORE_FACTOR) so the UI's
// confidence-threshold highlight correctly flags it as low-confidence.

export const DURATION_PROXIMITY_TOLERANCE_SECONDS = 90
export const DURATION_WEIGHT = 0.7
export const FILENAME_ONLY_SCORE_FACTOR = 0.6
export const LOW_CONFIDENCE_THRESHOLD = 0.6

export type Candidate = {
  name: string
  timecode?: string
}

export type UnrenamedFile = {
  filename: string
  durationSeconds: number | null
}

export type ScoredCandidate = {
  candidate: Candidate
  confidence: number
  durationScore: number
  filenameScore: number
}

export type FileSuggestion = {
  filename: string
  durationSeconds: number | null
  rankedCandidates: ScoredCandidate[]
}

// Parse a timecode string (e.g. "1:30:45" or "12:34" or "45") into total
// seconds. Returns NaN for unparseable input so callers can branch.
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

// Range 0..1. NaN inputs (or missing timecode / null duration) yield NaN
// so callers can branch — 0 would imply "we know they're far apart",
// NaN means "we don't know."
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

// Top-level helper used by the modal. Returns per-file ranked
// suggestion arrays — empty when either input list is empty (the modal
// renders an "empty state" in that case).
export const rankSuggestions = ({
  candidates,
  unrenamedFiles,
}: {
  candidates: Candidate[]
  unrenamedFiles: UnrenamedFile[]
}): FileSuggestion[] =>
  unrenamedFiles.map(({ filename, durationSeconds }) => ({
    filename,
    durationSeconds,
    rankedCandidates: rankCandidatesForFile({
      fileDurationSeconds: durationSeconds,
      filename,
      candidates,
    }),
  }))
