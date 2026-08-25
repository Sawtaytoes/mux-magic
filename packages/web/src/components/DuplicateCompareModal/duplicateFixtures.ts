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

// Each match strength gets its own album, so a table showing all three
// reads as three separate findings rather than the same row repeated.
const ALBUM_BY_MATCH_REASON: Record<
  DuplicateMatchReason,
  { artist: string; album: string; track: string }
> = {
  audio: {
    album: "Long Way Down",
    artist: "Harbour Lights",
    track: "01 Tidewater",
  },
  fingerprint: {
    album: "Tidewater",
    artist: "Nova Harbour",
    track: "04 Slack Water",
  },
  tags: {
    album: "Second Crossing",
    artist: "Pale Ferry",
    track: "07 Ebb Line",
  },
}

export const buildDuplicateGroup = ({
  groupKey = "group-1",
  matchReason = "audio",
}: {
  groupKey?: string
  matchReason?: DuplicateMatchReason
} = {}): DuplicateGroup =>
  ((folder: string) => ({
    copies: [
      buildDuplicateCopy({
        bitDepth: 16,
        filePath: `${folder}.flac`,
        fileSizeBytes: 28_400_000,
        isRecommendedKeep: true,
        rankReasons: [
          "lossless: lossless",
          "bit depth: 16-bit",
        ],
        sampleRate: 44_100,
      }),
      buildDuplicateCopy({
        filePath: `${folder}.mp3`,
        fileSizeBytes: 8_100_000,
      }),
    ],
    groupKey,
    isDuplicateGroup: true,
    matchReason,
  }))(
    ((album) =>
      `/library/${album.artist}/${album.album}/${album.track}`)(
      ALBUM_BY_MATCH_REASON[matchReason],
    ),
  )
