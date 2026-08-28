// Release ranker for the music tagger. Shape follows
// `nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts` — weighted sub-scores,
// exported named constants, a `Scored*` type — but every number here comes from
// the owner's Picard config, not from that file.
//
// ⚠️ The NSF scorer's `LOW_CONFIDENCE_THRESHOLD = 0.6` is NOT reused. Music has
// its own three thresholds and they are different numbers.

// Picard `file_lookup_threshold` — auto-accept a single-file lookup.
export const FILE_LOOKUP_THRESHOLD = 0.7

// Picard `cluster_lookup_threshold` — auto-accept a whole-cluster lookup.
export const CLUSTER_LOOKUP_THRESHOLD = 0.7

// Picard `track_matching_threshold` — below this a file is not matched to a
// release track at all.
export const TRACK_MATCHING_THRESHOLD = 0.4

// Picard `ignore_track_duration_difference_under = 2`. A difference strictly
// under two seconds does not count against a match at all.
export const IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS = 2_000

// Past the ignored window, the duration score decays to zero over this span.
// Not a Picard setting — Picard only publishes the ignore window — so it is a
// named constant a call site can tune.
export const DURATION_DECAY_MILLISECONDS = 30_000

// Picard `preferred_release_countries`, in order.
export const DEFAULT_PREFERRED_COUNTRIES = ["US", "JP"]

// Picard `preferred_release_formats`, in order.
export const DEFAULT_PREFERRED_FORMATS = [
  "Digital Media",
  "CD",
]

// Picard `release_type_scores` — every type weighted 0.5. Album, single, EP,
// soundtrack, compilation and the rest are all equal. There is no preference
// for "album" and inventing one would change which release gets picked.
export const DEFAULT_RELEASE_TYPE_SCORE = 0.5

export const DEFAULT_RELEASE_TYPE_SCORES: Record<
  string,
  number
> = {
  album: DEFAULT_RELEASE_TYPE_SCORE,
  audiobook: DEFAULT_RELEASE_TYPE_SCORE,
  broadcast: DEFAULT_RELEASE_TYPE_SCORE,
  compilation: DEFAULT_RELEASE_TYPE_SCORE,
  demo: DEFAULT_RELEASE_TYPE_SCORE,
  "dj-mix": DEFAULT_RELEASE_TYPE_SCORE,
  ep: DEFAULT_RELEASE_TYPE_SCORE,
  interview: DEFAULT_RELEASE_TYPE_SCORE,
  live: DEFAULT_RELEASE_TYPE_SCORE,
  mixtape: DEFAULT_RELEASE_TYPE_SCORE,
  other: DEFAULT_RELEASE_TYPE_SCORE,
  remix: DEFAULT_RELEASE_TYPE_SCORE,
  single: DEFAULT_RELEASE_TYPE_SCORE,
  soundtrack: DEFAULT_RELEASE_TYPE_SCORE,
  spokenword: DEFAULT_RELEASE_TYPE_SCORE,
}

// The four match components sum to 1, so `matchConfidence` stays in [0, 1] and
// can be compared with the three Picard thresholds above.
export const TRACK_COUNT_WEIGHT = 0.3
export const TITLE_SIMILARITY_WEIGHT = 0.25
export const ARTIST_SIMILARITY_WEIGHT = 0.2
export const DURATION_WEIGHT = 0.25

// Country, format and release type are a RANKING input, not a filter. They are
// deliberately small: they re-order two releases of the same album, and they
// can never lift a wrong album over a right one. A European pressing with no
// preference bonus is still a candidate and still appears in the results.
export const COUNTRY_PREFERENCE_WEIGHT = 0.06
export const FORMAT_PREFERENCE_WEIGHT = 0.06
export const RELEASE_TYPE_WEIGHT = 0.04

// Structural subsets, declared locally so this scorer takes plain fixtures in
// tests. `MusicBrainzRelease` from `musicBrainzApi.ts` satisfies
// `ReleaseCandidate` without a cast.
export type ReleaseCandidateFile = {
  album?: string
  albumArtist?: string
  artist?: string
  discNumber?: number
  durationSeconds?: number
  title?: string
  trackNumber?: number
}

export type ReleaseCandidateTrack = {
  lengthMilliseconds: number | null
  position: number
  title: string
}

export type ReleaseCandidateMedium = {
  discNumber: number
  tracks: ReleaseCandidateTrack[]
}

export type ReleaseCandidate = {
  artistCredit: { name: string }[]
  country: string
  formats: string[]
  media: ReleaseCandidateMedium[]
  primaryType: string
  releaseId: string
  secondaryTypes: string[]
  title: string
  trackCount: number
}

export type ScoredReleaseCandidate = {
  artistScore: number
  candidate: ReleaseCandidate
  countryScore: number
  durationScore: number
  formatScore: number
  isAboveClusterLookupThreshold: boolean
  matchConfidence: number
  releaseTypeScore: number
  score: number
  titleScore: number
  trackCountScore: number
}

const tokenizeWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  )

// Jaccard overlap of word tokens. Symmetric, so a candidate title that is a
// superset of the file's album name is penalised the same way as a subset.
const countSharedWords = ({
  leftWords,
  rightWords,
}: {
  leftWords: Set<string>
  rightWords: Set<string>
}) =>
  Array.from(leftWords).filter((word) =>
    rightWords.has(word),
  ).length

const scoreWordOverlap = ({
  leftWords,
  rightWords,
}: {
  leftWords: Set<string>
  rightWords: Set<string>
}) =>
  leftWords.size === 0 || rightWords.size === 0
    ? Number.NaN
    : countSharedWords({ leftWords, rightWords }) /
      (leftWords.size +
        rightWords.size -
        countSharedWords({ leftWords, rightWords }))

export const scoreTextSimilarity = ({
  leftText,
  rightText,
}: {
  leftText: string
  rightText: string
}) =>
  scoreWordOverlap({
    leftWords: tokenizeWords(leftText),
    rightWords: tokenizeWords(rightText),
  })

export const scoreTrackCountMatch = ({
  candidateTrackCount,
  fileCount,
}: {
  candidateTrackCount: number
  fileCount: number
}) =>
  fileCount === 0
    ? Number.NaN
    : Math.max(
        0,
        1 -
          Math.abs(candidateTrackCount - fileCount) /
            fileCount,
      )

// The 2-second rule: a difference strictly under
// IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS scores a perfect 1. At or past
// it, the score decays linearly to 0 over DURATION_DECAY_MILLISECONDS.
const scoreDurationDifference = (
  differenceMilliseconds: number,
) =>
  differenceMilliseconds <
  IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS
    ? 1
    : Math.max(
        0,
        1 -
          (differenceMilliseconds -
            IGNORED_TRACK_DURATION_DIFFERENCE_MILLISECONDS) /
            DURATION_DECAY_MILLISECONDS,
      )

export const scoreDurationMatch = ({
  candidateLengthMilliseconds,
  fileDurationSeconds,
}: {
  candidateLengthMilliseconds: number | null
  fileDurationSeconds: number | undefined
}) =>
  candidateLengthMilliseconds === null ||
  typeof fileDurationSeconds !== "number" ||
  Number.isNaN(fileDurationSeconds)
    ? Number.NaN
    : scoreDurationDifference(
        Math.abs(
          candidateLengthMilliseconds -
            fileDurationSeconds * 1_000,
        ),
      )

// Position in the preference list, scaled so the first entry scores 1 and an
// absent value scores 0. US beats JP beats everything else, and "everything
// else" is still ranked, not dropped.
const scoreOnePreference = ({
  preferences,
  value,
}: {
  preferences: string[]
  value: string
}) =>
  scorePreferenceIndex({
    preferenceIndex: preferences.findIndex(
      (preference) =>
        preference.toLowerCase() ===
        value.trim().toLowerCase(),
    ),
    preferenceCount: preferences.length,
  })

const scorePreferenceIndex = ({
  preferenceCount,
  preferenceIndex,
}: {
  preferenceCount: number
  preferenceIndex: number
}) =>
  preferenceIndex < 0
    ? 0
    : 1 - preferenceIndex / preferenceCount

export const scorePreferenceRank = ({
  preferences,
  values,
}: {
  preferences: string[]
  values: string[]
}) =>
  preferences.length === 0
    ? 0
    : values.reduce(
        (bestScore, value) =>
          Math.max(
            bestScore,
            scoreOnePreference({ preferences, value }),
          ),
        0,
      )

export const scoreReleaseType = ({
  primaryType,
  releaseTypeScores,
  secondaryTypes,
}: {
  primaryType: string
  releaseTypeScores: Record<string, number>
  secondaryTypes: string[]
}) =>
  [primaryType]
    .concat(secondaryTypes)
    .filter((releaseType) => releaseType.length > 0)
    .reduce(
      (bestScore, releaseType) =>
        Math.max(
          bestScore,
          releaseTypeScores[releaseType.toLowerCase()] ??
            DEFAULT_RELEASE_TYPE_SCORE,
        ),
      0,
    )

const getCandidateTracks = (candidate: ReleaseCandidate) =>
  candidate.media.flatMap((medium) =>
    medium.tracks.map((track) => ({
      discNumber: medium.discNumber,
      ...track,
    })),
  )

// Files are lined up with release tracks by disc + track number when the file
// has them, and by ordinal position when it does not.
const findMatchingTrack = ({
  candidateTracks,
  file,
  fileIndex,
}: {
  candidateTracks: (ReleaseCandidateTrack & {
    discNumber: number
  })[]
  file: ReleaseCandidateFile
  fileIndex: number
}) =>
  typeof file.trackNumber === "number"
    ? candidateTracks.find(
        (track) =>
          track.position === file.trackNumber &&
          (typeof file.discNumber === "number"
            ? track.discNumber === file.discNumber
            : true),
      )
    : candidateTracks.at(fileIndex)

const scoreMatchedTrackDuration = ({
  file,
  matchedTrack,
}: {
  file: ReleaseCandidateFile
  matchedTrack: ReleaseCandidateTrack | undefined
}) =>
  matchedTrack
    ? scoreDurationMatch({
        candidateLengthMilliseconds:
          matchedTrack.lengthMilliseconds,
        fileDurationSeconds: file.durationSeconds,
      })
    : Number.NaN

const averageScores = (scores: number[]) =>
  scores.length === 0
    ? Number.NaN
    : scores.reduce((total, score) => total + score, 0) /
      scores.length

const scoreDurationsAgainstTracks = ({
  candidateTracks,
  files,
}: {
  candidateTracks: (ReleaseCandidateTrack & {
    discNumber: number
  })[]
  files: ReleaseCandidateFile[]
}) =>
  averageScores(
    files
      .map((file, fileIndex) =>
        scoreMatchedTrackDuration({
          file,
          matchedTrack: findMatchingTrack({
            candidateTracks,
            file,
            fileIndex,
          }),
        }),
      )
      .filter(
        (durationScore) => !Number.isNaN(durationScore),
      ),
  )

const scoreCandidateDurations = ({
  candidate,
  files,
}: {
  candidate: ReleaseCandidate
  files: ReleaseCandidateFile[]
}) =>
  scoreDurationsAgainstTracks({
    candidateTracks: getCandidateTracks(candidate),
    files,
  })

type MatchComponent = { score: number; weight: number }

const getTotalWeight = (components: MatchComponent[]) =>
  components.reduce(
    (total, component) => total + component.weight,
    0,
  )

const weightedMean = (components: MatchComponent[]) =>
  getTotalWeight(components) === 0
    ? 0
    : components.reduce(
        (total, component) =>
          total + component.weight * component.score,
        0,
      ) / getTotalWeight(components)

// The weighted mean skips components the input cannot support (no album tag,
// no durations) by renormalising over the weights that DID contribute. Without
// that, a folder of untagged files would score every candidate near zero and
// the ranking would be noise.
const combineMatchScores = (components: MatchComponent[]) =>
  weightedMean(
    components.filter(
      (component) => !Number.isNaN(component.score),
    ),
  )

const getIsPresentValue = (
  value: string | undefined,
): value is string =>
  typeof value === "string" && value.trim().length > 0

const countByValue = (values: string[]) =>
  values.reduce(
    (counts: Map<string, number>, value) =>
      counts.set(value, (counts.get(value) ?? 0) + 1),
    new Map<string, number>(),
  )

const pickHighestCount = (
  countsByValue: Map<string, number>,
) =>
  Array.from(countsByValue.entries())
    .toSorted(
      (firstEntry, secondEntry) =>
        secondEntry[1] - firstEntry[1] ||
        firstEntry[0].localeCompare(secondEntry[0]),
    )
    .at(0)?.[0] ?? ""

const pickMostCommonValue = (
  values: (string | undefined)[],
) =>
  pickHighestCount(
    countByValue(values.filter(getIsPresentValue)),
  )

type ReleaseSubScores = {
  artistScore: number
  candidate: ReleaseCandidate
  countryScore: number
  durationScore: number
  formatScore: number
  releaseTypeScore: number
  titleScore: number
  trackCountScore: number
}

const buildConfidenceFields = ({
  countryScore,
  formatScore,
  matchConfidence,
  releaseTypeScore,
}: {
  countryScore: number
  formatScore: number
  matchConfidence: number
  releaseTypeScore: number
}) => ({
  isAboveClusterLookupThreshold:
    matchConfidence >= CLUSTER_LOOKUP_THRESHOLD,
  matchConfidence,
  score:
    matchConfidence +
    COUNTRY_PREFERENCE_WEIGHT * countryScore +
    FORMAT_PREFERENCE_WEIGHT * formatScore +
    RELEASE_TYPE_WEIGHT * releaseTypeScore,
})

const assembleScoredCandidate = (
  subScores: ReleaseSubScores,
): ScoredReleaseCandidate => ({
  ...subScores,
  ...buildConfidenceFields({
    countryScore: subScores.countryScore,
    formatScore: subScores.formatScore,
    matchConfidence: combineMatchScores([
      {
        score: subScores.trackCountScore,
        weight: TRACK_COUNT_WEIGHT,
      },
      {
        score: subScores.titleScore,
        weight: TITLE_SIMILARITY_WEIGHT,
      },
      {
        score: subScores.artistScore,
        weight: ARTIST_SIMILARITY_WEIGHT,
      },
      {
        score: subScores.durationScore,
        weight: DURATION_WEIGHT,
      },
    ]),
    releaseTypeScore: subScores.releaseTypeScore,
  }),
})

const scoreReleaseCandidate = ({
  candidate,
  fileAlbumName,
  fileArtistName,
  files,
  preferredCountries,
  preferredFormats,
  releaseTypeScores,
}: {
  candidate: ReleaseCandidate
  fileAlbumName: string
  fileArtistName: string
  files: ReleaseCandidateFile[]
  preferredCountries: string[]
  preferredFormats: string[]
  releaseTypeScores: Record<string, number>
}) =>
  assembleScoredCandidate({
    artistScore: scoreTextSimilarity({
      leftText: fileArtistName,
      rightText: candidate.artistCredit
        .map((part) => part.name)
        .join(" "),
    }),
    candidate,
    countryScore: scorePreferenceRank({
      preferences: preferredCountries,
      values: [candidate.country],
    }),
    durationScore: scoreCandidateDurations({
      candidate,
      files,
    }),
    formatScore: scorePreferenceRank({
      preferences: preferredFormats,
      values: candidate.formats,
    }),
    releaseTypeScore: scoreReleaseType({
      primaryType: candidate.primaryType,
      releaseTypeScores,
      secondaryTypes: candidate.secondaryTypes,
    }),
    titleScore: scoreTextSimilarity({
      leftText: fileAlbumName,
      rightText: candidate.title,
    }),
    trackCountScore: scoreTrackCountMatch({
      candidateTrackCount: candidate.trackCount,
      fileCount: files.length,
    }),
  })

const rankAgainstClusterTags = ({
  candidates,
  fileAlbumName,
  fileArtistName,
  files,
  preferredCountries,
  preferredFormats,
  releaseTypeScores,
}: {
  candidates: ReleaseCandidate[]
  fileAlbumName: string
  fileArtistName: string
  files: ReleaseCandidateFile[]
  preferredCountries: string[]
  preferredFormats: string[]
  releaseTypeScores: Record<string, number>
}) =>
  candidates
    .map((candidate) =>
      scoreReleaseCandidate({
        candidate,
        fileAlbumName,
        fileArtistName,
        files,
        preferredCountries,
        preferredFormats,
        releaseTypeScores,
      }),
    )
    .toSorted(
      (firstScored, secondScored) =>
        secondScored.score - firstScored.score ||
        firstScored.candidate.releaseId.localeCompare(
          secondScored.candidate.releaseId,
        ),
    )

export const rankReleaseCandidates = ({
  candidates,
  files,
  preferredCountries = DEFAULT_PREFERRED_COUNTRIES,
  preferredFormats = DEFAULT_PREFERRED_FORMATS,
  releaseTypeScores = DEFAULT_RELEASE_TYPE_SCORES,
}: {
  candidates: ReleaseCandidate[]
  files: ReleaseCandidateFile[]
  preferredCountries?: string[]
  preferredFormats?: string[]
  releaseTypeScores?: Record<string, number>
}) =>
  rankAgainstClusterTags({
    candidates,
    fileAlbumName: pickMostCommonValue(
      files.map((file) => file.album),
    ),
    fileArtistName: pickMostCommonValue(
      files.map((file) => file.albumArtist ?? file.artist),
    ),
    files,
    preferredCountries,
    preferredFormats,
    releaseTypeScores,
  })
