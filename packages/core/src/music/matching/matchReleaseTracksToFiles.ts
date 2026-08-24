import {
  scoreDurationMatch,
  scoreTextSimilarity,
  TRACK_MATCHING_THRESHOLD,
} from "../../tools/rankReleaseCandidates.js"

// Picard's per-track match, and only that. `rankReleaseCandidates` answers
// "which release is this folder?"; this answers "which track on that release
// is this file?" — the question the tag diff needs one row at a time.
//
// Three signals, because no single one is trustworthy on its own. Track
// numbers are wrong or absent on exactly the untagged files that need the
// tagger most. Titles differ by punctuation and by feat. credits. Durations
// agree across releases of the same recording, so a duration match alone
// picks an arbitrary one of two identical tracks.
export const TITLE_MATCH_WEIGHT = 0.45
export const DURATION_MATCH_WEIGHT = 0.35
export const POSITION_MATCH_WEIGHT = 0.2

// A file whose disc number disagrees with the medium is not simply a weaker
// match — it is a different disc. Scoring it as "position 0" would let a
// 12-track disc 2 outrank the correct disc 1 track on title alone.
export const WRONG_DISC_POSITION_SCORE = 0

export type ReleaseTrackForMatching = {
  discNumber: number
  lengthMilliseconds: number | null
  position: number
  recordingId?: string
  title: string
  totalTracksOnMedium?: number
}

export type FileForTrackMatching = {
  discNumber?: number
  durationSeconds?: number
  filePath: string
  title?: string
  trackNumber?: number
}

export type TrackFileMatch = {
  filePath: string
  matchConfidence: number
  track: ReleaseTrackForMatching | null
}

type MatchComponent = {
  score: number
  weight: number
}

const getTrackKey = (track: ReleaseTrackForMatching) =>
  `${track.discNumber}/${track.position}`

// Only the signals the pair actually has are averaged. A file with no title
// tag must not be punished for the missing field — it is scored on duration
// and position, and the threshold judges that smaller evidence set.
const weightedMean = (components: MatchComponent[]) =>
  ((present: MatchComponent[]) =>
    present.length === 0
      ? 0
      : present.reduce(
          (total, component) =>
            total + component.score * component.weight,
          0,
        ) /
        present.reduce(
          (total, component) => total + component.weight,
          0,
        ))(
    components.filter(
      (component) => !Number.isNaN(component.score),
    ),
  )

const scorePosition = ({
  file,
  track,
}: {
  file: FileForTrackMatching
  track: ReleaseTrackForMatching
}) =>
  typeof file.discNumber === "number" &&
  file.discNumber !== track.discNumber
    ? WRONG_DISC_POSITION_SCORE
    : typeof file.trackNumber !== "number"
      ? Number.NaN
      : file.trackNumber === track.position
        ? 1
        : 0

const scoreTitle = ({
  file,
  track,
}: {
  file: FileForTrackMatching
  track: ReleaseTrackForMatching
}) =>
  typeof file.title === "string" &&
  file.title.trim().length > 0
    ? scoreTextSimilarity({
        leftText: file.title,
        rightText: track.title,
      })
    : Number.NaN

export const scoreTrackAgainstFile = ({
  file,
  track,
}: {
  file: FileForTrackMatching
  track: ReleaseTrackForMatching
}) =>
  weightedMean([
    {
      score: scoreTitle({ file, track }),
      weight: TITLE_MATCH_WEIGHT,
    },
    {
      score: scoreDurationMatch({
        candidateLengthMilliseconds:
          track.lengthMilliseconds,
        fileDurationSeconds: file.durationSeconds,
      }),
      weight: DURATION_MATCH_WEIGHT,
    },
    {
      score: scorePosition({ file, track }),
      weight: POSITION_MATCH_WEIGHT,
    },
  ])

type ScoredPair = {
  file: FileForTrackMatching
  score: number
  track: ReleaseTrackForMatching
}

// Sorted best-first, with a total order so the same inputs always produce the
// same assignment. Two tracks that score identically (a release listing the
// same recording twice) would otherwise swap between runs and the diff would
// look like it changed when nothing did.
const comparePairs = (
  firstPair: ScoredPair,
  secondPair: ScoredPair,
) =>
  secondPair.score - firstPair.score ||
  firstPair.file.filePath.localeCompare(
    secondPair.file.filePath,
  ) ||
  firstPair.track.discNumber -
    secondPair.track.discNumber ||
  firstPair.track.position - secondPair.track.position

type Assignment = {
  matchesByFilePath: Map<string, ScoredPair>
  usedTrackKeys: Set<string>
}

// Greedy, not optimal. A globally optimal assignment (Hungarian) costs more
// code than it buys here: the pairs that matter score far apart, and the ones
// that score close are near-identical tracks where either answer is right.
const assignBestPairs = (pairs: ScoredPair[]) =>
  pairs.reduce(
    (assignment: Assignment, pair) =>
      assignment.matchesByFilePath.has(
        pair.file.filePath,
      ) ||
      assignment.usedTrackKeys.has(getTrackKey(pair.track))
        ? assignment
        : {
            matchesByFilePath:
              assignment.matchesByFilePath.set(
                pair.file.filePath,
                pair,
              ),
            usedTrackKeys: assignment.usedTrackKeys.add(
              getTrackKey(pair.track),
            ),
          },
    {
      matchesByFilePath: new Map<string, ScoredPair>(),
      usedTrackKeys: new Set<string>(),
    },
  )

export const matchReleaseTracksToFiles = ({
  files,
  trackMatchingThreshold = TRACK_MATCHING_THRESHOLD,
  tracks,
}: {
  files: FileForTrackMatching[]
  trackMatchingThreshold?: number
  tracks: ReleaseTrackForMatching[]
}): TrackFileMatch[] =>
  ((assignment: Assignment) =>
    files.map((file) =>
      ((matched) =>
        matched === undefined
          ? {
              filePath: file.filePath,
              matchConfidence: 0,
              track: null,
            }
          : {
              filePath: file.filePath,
              matchConfidence: matched.score,
              track: matched.track,
            })(
        assignment.matchesByFilePath.get(file.filePath),
      ),
    ))(
    assignBestPairs(
      files
        .flatMap((file) =>
          tracks.map((track) => ({
            file,
            score: scoreTrackAgainstFile({ file, track }),
            track,
          })),
        )
        .filter(
          (pair) => pair.score >= trackMatchingThreshold,
        )
        .toSorted(comparePairs),
    ),
  )
