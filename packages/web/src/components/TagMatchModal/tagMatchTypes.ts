// Narrow type mirrors of the server-side music tagger shapes. The web
// side keeps its own copy — same pattern `smartMatchTypes.ts` uses —
// so server-side type churn does not ripple into web typecheck.
//
// Source of truth: the server. Change a field here and change the
// matching field on the server type too.

// Picard's own thresholds, NOT SmartMatch's LOW_CONFIDENCE_THRESHOLD
// of 0.6. Music has three separate numbers and reusing the video
// modal's single 0.6 would silently mis-gate every row.
// `file_lookup_threshold`: auto-accept a single-file lookup at or
// above this score. A row at or above it starts checked.
export const FILE_LOOKUP_THRESHOLD = 0.7

// `cluster_lookup_threshold`: the same bar for a whole cluster.
export const CLUSTER_LOOKUP_THRESHOLD = 0.7

// `track_matching_threshold`: below this a track is not matched to a
// release track at all. A row below it renders as unmatched.
export const TRACK_MATCHING_THRESHOLD = 0.4

export type AudioTagFieldName =
  | "title"
  | "artist"
  | "albumArtist"
  | "album"
  | "trackNumber"
  | "totalTracks"
  | "discNumber"
  | "totalDiscs"
  | "date"
  | "genres"
  | "composer"

export type TagValue =
  | string
  | string[]
  | number
  | undefined

export type AudioTagSet = Partial<
  Record<AudioTagFieldName, TagValue>
>

export type ReleaseCandidate = {
  releaseId: string
  releaseTitle: string
  artistName: string
  country?: string
  format?: string
  year?: string
  trackCount?: number
  label?: string
  source: "freedb" | "musicbrainz" | "vgmdb"
}

export type ScoredReleaseCandidate = {
  candidate: ReleaseCandidate
  confidence: number
  proposedTags: AudioTagSet
}

export type TagMatchFile = {
  filePath: string
  filename: string
  extension: string
  durationSeconds: number | null
  currentTags: AudioTagSet
  rankedCandidates: ScoredReleaseCandidate[]
}

// Render order for the per-field diff list and the bulk-edit field
// pickers. Every field the tagger writes appears exactly once.
export const AUDIO_TAG_FIELD_NAMES: AudioTagFieldName[] = [
  "title",
  "artist",
  "albumArtist",
  "album",
  "trackNumber",
  "totalTracks",
  "discNumber",
  "totalDiscs",
  "date",
  "genres",
  "composer",
]

export const AUDIO_TAG_FIELD_LABELS: Record<
  AudioTagFieldName,
  string
> = {
  title: "Title",
  artist: "Artist",
  albumArtist: "Album Artist",
  album: "Album",
  trackNumber: "Track Number",
  totalTracks: "Total Tracks",
  discNumber: "Disc Number",
  totalDiscs: "Total Discs",
  date: "Date",
  genres: "Genres",
  composer: "Composer",
}

// `genres` is the one multi-value field; it edits as a comma-separated
// string and commits as an array.
export const MULTI_VALUE_TAG_FIELD_NAMES: AudioTagFieldName[] =
  ["genres"]

// Numeric fields compare numerically, so "01" and 1 are the same
// value rather than a spurious change.
export const NUMERIC_TAG_FIELD_NAMES: AudioTagFieldName[] =
  ["trackNumber", "totalTracks", "discNumber", "totalDiscs"]
