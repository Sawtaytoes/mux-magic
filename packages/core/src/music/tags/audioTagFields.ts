export type AudioTags = {
  title?: string
  artist?: string
  albumArtist?: string
  album?: string
  trackNumber?: number
  totalTracks?: number
  discNumber?: number
  totalDiscs?: number
  date?: string
  genres?: string[]
  composer?: string
  comment?: string
  musicBrainzReleaseId?: string
  musicBrainzRecordingId?: string
  musicBrainzArtistId?: string
  musicBrainzAlbumArtistId?: string
  musicBrainzReleaseGroupId?: string
  acoustIdFingerprint?: string
  acoustIdId?: string
  isCompilation?: boolean
}

export type AudioTagField = keyof AudioTags

export type AudioFileInfo = {
  filePath: string
  codec?: string
  bitDepth?: number
  sampleRate?: number
  channelCount?: number
  durationSeconds?: number
  bitRate?: number
  fileSizeBytes: number
  hasEmbeddedCoverArt: boolean
}

export const AUDIO_TAG_FIELDS = [
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
  "comment",
  "musicBrainzReleaseId",
  "musicBrainzRecordingId",
  "musicBrainzArtistId",
  "musicBrainzAlbumArtistId",
  "musicBrainzReleaseGroupId",
  "acoustIdFingerprint",
  "acoustIdId",
  "isCompilation",
] as const satisfies readonly AudioTagField[]

export const MULTI_VALUE_AUDIO_TAG_FIELDS = [
  "genres",
] as const satisfies readonly AudioTagField[]

export const NUMERIC_AUDIO_TAG_FIELDS = [
  "trackNumber",
  "totalTracks",
  "discNumber",
  "totalDiscs",
] as const satisfies readonly AudioTagField[]

export const AUDIO_FILE_EXTENSIONS = [
  ".flac",
  ".mp3",
  ".m4a",
  ".mp4",
  ".ogg",
  ".opus",
  ".wav",
  ".aiff",
  ".wv",
  ".ape",
  ".mka",
] as const

export type AudioFileExtension =
  (typeof AUDIO_FILE_EXTENSIONS)[number]
