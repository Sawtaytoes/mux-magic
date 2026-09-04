import { stat } from "node:fs/promises"
import {
  type IAudioMetadata,
  parseFile,
} from "music-metadata"
import type {
  AudioFileInfo,
  AudioTags,
} from "./audioTagFields.js"

type NativeTagEntry = {
  id: string
  value: unknown
}

const NATIVE_KEYS_BY_FIELD = {
  acoustIdFingerprint: [
    "ACOUSTID_FINGERPRINT",
    "TXXX:Acoustid Fingerprint",
    "----:com.apple.iTunes:Acoustid Fingerprint",
  ],
  acoustIdId: [
    "ACOUSTID_ID",
    "TXXX:Acoustid Id",
    "----:com.apple.iTunes:Acoustid Id",
  ],
  musicBrainzAlbumArtistId: [
    "MUSICBRAINZ_ALBUMARTISTID",
    "TXXX:MusicBrainz Album Artist Id",
    "----:com.apple.iTunes:MusicBrainz Album Artist Id",
  ],
  musicBrainzArtistId: [
    "MUSICBRAINZ_ARTISTID",
    "TXXX:MusicBrainz Artist Id",
    "----:com.apple.iTunes:MusicBrainz Artist Id",
  ],
  musicBrainzRecordingId: [
    "MUSICBRAINZ_TRACKID",
    "TXXX:MusicBrainz Track Id",
    "----:com.apple.iTunes:MusicBrainz Track Id",
  ],
  musicBrainzReleaseGroupId: [
    "MUSICBRAINZ_RELEASEGROUPID",
    "TXXX:MusicBrainz Release Group Id",
    "----:com.apple.iTunes:MusicBrainz Release Group Id",
  ],
  musicBrainzReleaseId: [
    "MUSICBRAINZ_ALBUMID",
    "TXXX:MusicBrainz Album Id",
    "----:com.apple.iTunes:MusicBrainz Album Id",
  ],
} as const

const emptyToUndefined = (value: string | undefined) =>
  value === undefined || value === "" ? undefined : value

const numberOrUndefined = (
  value: number | null | undefined,
) => (typeof value === "number" ? value : undefined)

const flattenNativeTags = (
  nativeTags: Record<string, NativeTagEntry[]>,
) =>
  Object.values(nativeTags)
    .flat()
    .filter(
      (nativeTag) =>
        typeof nativeTag.value === "string" &&
        nativeTag.value !== "",
    )
    .reduce(
      (accumulated, nativeTag) =>
        accumulated.has(nativeTag.id.toLowerCase())
          ? accumulated
          : accumulated.set(
              nativeTag.id.toLowerCase(),
              nativeTag.value as string,
            ),
      new Map<string, string>(),
    )

const readNativeField = ({
  flattenedNativeTags,
  nativeKeys,
}: {
  flattenedNativeTags: Map<string, string>
  nativeKeys: readonly string[]
}) =>
  nativeKeys.reduce<string | undefined>(
    (found, nativeKey) =>
      found ??
      flattenedNativeTags.get(nativeKey.toLowerCase()),
    undefined,
  )

const buildTagsFromFlattenedNativeTags = ({
  commonTags,
  flattenedNativeTags,
}: {
  commonTags: IAudioMetadata["common"]
  flattenedNativeTags: Map<string, string>
}): AudioTags => ({
  acoustIdFingerprint:
    emptyToUndefined(commonTags.acoustid_fingerprint) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys: NATIVE_KEYS_BY_FIELD.acoustIdFingerprint,
    }),
  acoustIdId:
    emptyToUndefined(commonTags.acoustid_id) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys: NATIVE_KEYS_BY_FIELD.acoustIdId,
    }),
  album: emptyToUndefined(commonTags.album),
  albumArtist: emptyToUndefined(commonTags.albumartist),
  artist: emptyToUndefined(commonTags.artist),
  comment: emptyToUndefined(
    commonTags.comment?.[0]?.text ?? undefined,
  ),
  composer: emptyToUndefined(commonTags.composer?.[0]),
  date:
    emptyToUndefined(commonTags.date) ??
    (typeof commonTags.year === "number"
      ? String(commonTags.year)
      : undefined),
  discNumber: numberOrUndefined(commonTags.disk?.no),
  genres:
    commonTags.genre === undefined ||
    commonTags.genre.length === 0
      ? undefined
      : commonTags.genre,
  isCompilation: commonTags.compilation,
  musicBrainzAlbumArtistId:
    emptyToUndefined(
      commonTags.musicbrainz_albumartistid?.[0],
    ) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys:
        NATIVE_KEYS_BY_FIELD.musicBrainzAlbumArtistId,
    }),
  musicBrainzArtistId:
    emptyToUndefined(
      commonTags.musicbrainz_artistid?.[0],
    ) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys: NATIVE_KEYS_BY_FIELD.musicBrainzArtistId,
    }),
  musicBrainzRecordingId:
    emptyToUndefined(commonTags.musicbrainz_recordingid) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys:
        NATIVE_KEYS_BY_FIELD.musicBrainzRecordingId,
    }),
  musicBrainzReleaseGroupId:
    emptyToUndefined(
      commonTags.musicbrainz_releasegroupid,
    ) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys:
        NATIVE_KEYS_BY_FIELD.musicBrainzReleaseGroupId,
    }),
  musicBrainzReleaseId:
    emptyToUndefined(commonTags.musicbrainz_albumid) ??
    readNativeField({
      flattenedNativeTags,
      nativeKeys: NATIVE_KEYS_BY_FIELD.musicBrainzReleaseId,
    }),
  title: emptyToUndefined(commonTags.title),
  totalDiscs: numberOrUndefined(commonTags.disk?.of),
  totalTracks: numberOrUndefined(commonTags.track?.of),
  trackNumber: numberOrUndefined(commonTags.track?.no),
})

const buildAudioFileInfo = ({
  filePath,
  fileSizeBytes,
  metadata,
}: {
  filePath: string
  fileSizeBytes: number
  metadata: IAudioMetadata
}): AudioFileInfo => ({
  bitDepth: metadata.format.bitsPerSample,
  bitRate: metadata.format.bitrate,
  channelCount: metadata.format.numberOfChannels,
  codec: metadata.format.codec,
  durationSeconds: metadata.format.duration,
  filePath,
  fileSizeBytes,
  hasEmbeddedCoverArt:
    (metadata.common.picture?.length ?? 0) > 0,
  sampleRate: metadata.format.sampleRate,
})

export const readAudioTags = (filePath: string) =>
  Promise.all([
    parseFile(filePath, { duration: true }),
    stat(filePath),
  ])
    .then(([metadata, fileStats]) => ({
      info: buildAudioFileInfo({
        filePath,
        fileSizeBytes: fileStats.size,
        metadata,
      }),
      tags: buildTagsFromFlattenedNativeTags({
        commonTags: metadata.common,
        flattenedNativeTags: flattenNativeTags(
          metadata.native as Record<
            string,
            NativeTagEntry[]
          >,
        ),
      }),
    }))
    .catch((error: unknown) =>
      Promise.reject(
        new Error(
          `Cannot read audio tags from "${filePath}": ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
          { cause: error },
        ),
      ),
    )
