import type {
  DuplicateCopy,
  DuplicateGroup,
  DuplicateMatchReason,
} from "./duplicateCompareTypes"

// Shared fixture builders for the duplicate stories and tests.
//
// ⚠️ Invented album and artist names on purpose. A story is a PNG in a
// pull request and a fixture is opaque to every grep, so nothing here
// names anything from the real library.

export const buildDuplicateCopy = ({
  bitDepth,
  filePath,
  fileSizeBytes = 1_000_000,
  isRecommendedKeep = false,
  rankReasons = [],
  sampleRate,
}: {
  bitDepth?: number
  filePath: string
  fileSizeBytes?: number
  isRecommendedKeep?: boolean
  rankReasons?: string[]
  sampleRate?: number
}): DuplicateCopy => ({
  filePath,
  info: {
    bitDepth,
    codec: filePath.endsWith(".flac") ? "FLAC" : "MP3",
    fileSizeBytes,
    filePath,
    hasEmbeddedCoverArt: false,
    sampleRate,
  },
  isLossless: filePath.endsWith(".flac"),
  isRecommendedKeep,
  rankReasons,
})

export const buildDuplicateGroup = ({
  groupKey = "group-1",
  matchReason = "audio",
}: {
  groupKey?: string
  matchReason?: DuplicateMatchReason
} = {}): DuplicateGroup => ({
  copies: [
    buildDuplicateCopy({
      bitDepth: 16,
      filePath:
        "/library/Harbour Lights/Long Way Down/01 Tidewater.flac",
      fileSizeBytes: 28_400_000,
      isRecommendedKeep: true,
      rankReasons: [
        "lossless: lossless",
        "bit depth: 16-bit",
      ],
      sampleRate: 44_100,
    }),
    buildDuplicateCopy({
      filePath:
        "/library/Harbour Lights/Long Way Down/01 Tidewater.mp3",
      fileSizeBytes: 8_100_000,
    }),
  ],
  groupKey,
  isDuplicateGroup: true,
  matchReason,
})
