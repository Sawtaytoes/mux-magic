// Smart-suggestion ranker for the nameSpecialFeatures mapping modal
// (Option C from docs/options/specials-checkbox-list.md).
//
// Pure JS, no DOM access — exported helpers are unit-testable in plain
// vitest. Two scoring signals:
//   1. Duration proximity — when a candidate has a `timecode` AND the
//      file has a runtime, score by how close the two are. A 0-second
//      delta scores 1.0; deltas above DURATION_PROXIMITY_TOLERANCE_SECONDS
//      degrade linearly to 0.
//   2. Filename similarity — shared-word overlap between the file's
//      stem and the candidate label, normalized by candidate-word count.
//      Cheap, no Levenshtein dependency.
//
// When BOTH signals are available the combined score is a weighted blend
// (duration weighs heavier — file runtime is a much stronger signal than
// fuzzy filename overlap when DVDCompare published a runtime). When only
// filename signal is available the score degrades to filename-only with
// a small penalty (multiplied by FILENAME_ONLY_SCORE_FACTOR) so the UI's
// confidence-threshold highlight correctly flags it as low-confidence.

// Tuned against typical disc-rip drift (5–15 seconds is normal).
// Anything farther than this gets a near-zero proximity score.
export const DURATION_PROXIMITY_TOLERANCE_SECONDS = 90

// Combined score = DURATION_WEIGHT * duration + (1 - DURATION_WEIGHT) * filename
// Duration is the stronger signal when present; filename overlap is
// noisy on disc-rip filenames like MOVIE_t23.mkv.
export const DURATION_WEIGHT = 0.7

// When duration data isn't available at all (no candidate timecode OR no
// file runtime), the filename score is multiplied by this factor so the
// confidence number is honest — filename-only matches deserve scrutiny.
export const FILENAME_ONLY_SCORE_FACTOR = 0.6

// Below this confidence the modal renders the row in yellow / "review me"
// styling. Tuneable per the design doc's open question; 0.6 is the
// initial value.
export const LOW_CONFIDENCE_THRESHOLD = 0.6

// Parse a timecode string (e.g. "1:30:45" or "12:34" or "45") into total
// seconds. Returns NaN for unparseable input so callers can branch.
export const parseTimecodeToSeconds = (timecode) => {
  if (typeof timecode !== 'string' || timecode.length === 0) {
    return NaN
  }
  const segments = timecode.split(':').map((segment) => Number(segment))
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
    return segments[0] * 3600 + segments[1] * 60 + segments[2]
  }
  return NaN
}

// Strip the extension off a filename and lowercase it for comparison.
const normalizeStem = (filename) => {
  const dotIndex = filename.lastIndexOf('.')
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return stem.toLowerCase()
}

// Convert a string into a Set of word tokens (lowercase, alphanumeric
// chunks). Used for shared-word overlap scoring.
const tokenizeWords = (text) => (
  new Set(
    String(text)
    .toLowerCase()
    .split(/[\W_]+/u)
    .filter(Boolean)
  )
)

// Score one candidate's filename overlap with a file stem. Range 0..1.
// Returns 1.0 when every word of the candidate appears in the stem;
// scales down by candidate-word count.
export const scoreFilenameOverlap = ({ candidateName, filename }) => {
  const candidateWords = Array.from(tokenizeWords(candidateName))
  if (candidateWords.length === 0) {
    return 0
  }
  const stemWords = tokenizeWords(normalizeStem(filename))
  if (stemWords.size === 0) {
    return 0
  }
  const matchingWords = candidateWords.filter((word) => stemWords.has(word))
  return matchingWords.length / candidateWords.length
}

// Score duration proximity between a file runtime and a candidate
// timecode. Range 0..1. NaN inputs (or missing timecode) yield NaN so
// callers can branch (it's not 0 — 0 would imply "we know they're far
// apart", but NaN means "we don't know").
export const scoreDurationProximity = ({ candidateTimecode, fileTimecode }) => {
  const candidateSeconds = parseTimecodeToSeconds(candidateTimecode)
  const fileSeconds = parseTimecodeToSeconds(fileTimecode)
  if (Number.isNaN(candidateSeconds) || Number.isNaN(fileSeconds)) {
    return NaN
  }
  const deltaSeconds = Math.abs(candidateSeconds - fileSeconds)
  if (deltaSeconds >= DURATION_PROXIMITY_TOLERANCE_SECONDS) {
    return 0
  }
  return 1 - (deltaSeconds / DURATION_PROXIMITY_TOLERANCE_SECONDS)
}

// Combine a duration score and a filename score into one 0..1 confidence.
// Either input may be NaN to signal "unavailable"; the combiner falls
// back to whichever signal is present.
export const combineScores = ({ durationScore, filenameScore }) => {
  const hasDuration = !Number.isNaN(durationScore)
  const hasFilename = !Number.isNaN(filenameScore)
  if (!hasDuration && !hasFilename) {
    return 0
  }
  if (hasDuration && hasFilename) {
    return DURATION_WEIGHT * durationScore + (1 - DURATION_WEIGHT) * filenameScore
  }
  if (hasDuration) {
    return durationScore
  }
  return filenameScore * FILENAME_ONLY_SCORE_FACTOR
}

// Rank possibleNames against a single file. Returns the candidates
// sorted descending by combined confidence score. Each entry includes
// the original PossibleName ({ name, timecode? }), the per-signal
// scores, and the combined confidence in [0, 1].
export const rankCandidatesForFile = ({
  fileTimecode,
  filename,
  possibleNames,
}) => {
  const scored = possibleNames.map((candidate) => {
    const filenameScore = scoreFilenameOverlap({
      candidateName: candidate.name,
      filename,
    })
    const durationScore = scoreDurationProximity({
      candidateTimecode: candidate.timecode,
      fileTimecode,
    })
    const confidence = combineScores({ durationScore, filenameScore })
    return {
      candidate,
      confidence,
      durationScore,
      filenameScore,
    }
  })
  return scored.sort((firstEntry, secondEntry) => (
    secondEntry.confidence - firstEntry.confidence
  ))
}

// Top-level helper used by the modal. Takes the unrenamed filenames
// (each as `{ filename, timecode? }` — timecode optional, comes from
// /files/list?includeDuration=1) and the possibleNames list, returns
// per-file ranked suggestion arrays.
//
// `unrenamedFiles` is intentionally `{ filename, timecode? }[]` rather
// than `string[]` so the caller can attach durations resolved from the
// /files/list endpoint. Pass `[{ filename }]` (no timecode) when no
// runtime data is available — the helper will fall back to filename
// fuzz alone, matching the design doc's degraded-mode contract.
export const rankSuggestions = ({ possibleNames, unrenamedFiles }) => (
  unrenamedFiles.map(({ filename, timecode }) => ({
    filename,
    fileTimecode: timecode,
    rankedCandidates: rankCandidatesForFile({
      fileTimecode: timecode,
      filename,
      possibleNames,
    }),
  }))
)
