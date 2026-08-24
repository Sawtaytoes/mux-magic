import { basename, dirname, extname } from "node:path"

// Picard's Cluster step, and only that step.
//
// `cluster_new_files=true` with `analyze_new_files=false` is the whole
// workflow in two settings: group loose files into candidate albums from their
// EXISTING TAGS, look the cluster up, and reach for fingerprinting only when
// that fails. This module therefore does no network calls and no fingerprinting
// — fingerprinting every file on import is slow and was deliberately turned
// off. Nothing here should ever grow a fingerprint step.

// Picard `va_name`. Used to label a cluster whose files do not share an artist.
export const VARIOUS_ARTISTS_NAME = "Various Artists"

// A parent directory with one of these names says nothing about the album, so
// the filename guess is used instead.
export const GENERIC_DIRECTORY_NAMES = [
  "",
  ".",
  "..",
  "album",
  "audio",
  "downloads",
  "inbox",
  "music",
  "new",
  "temp",
  "tmp",
  "unsorted",
  "untagged",
]

// Structural input type, declared locally so this module does not depend on
// another package's file-scan shape.
export type AudioFileTags = {
  album?: string
  albumArtist?: string
  artist?: string
  discNumber?: number
  trackNumber?: number
}

export type AudioFileForClustering = {
  filePath: string
  tags: AudioFileTags
}

export type AudioFileCluster = {
  album: string
  albumArtist: string
  files: AudioFileForClustering[]
  trackCount: number
}

const getTrimmedTag = (value: string | undefined) =>
  typeof value === "string" ? value.trim() : ""

export const getParentDirectoryName = (filePath: string) =>
  basename(dirname(filePath))

// Last resort: read an album name out of the filename. Handles the two shapes
// that actually turn up — "01 - Album - Title.flac" and "Album - 01 Title.mp3"
// — by dropping a leading track number and keeping the first " - " segment.
const stripLeadingTrackNumber = (stem: string) =>
  stem.replace(/^\s*\d{1,3}\s*[-._]?\s*/u, "")

const getDashSeparatedSegments = (text: string) =>
  text
    .split(" - ")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

const pickAlbumSegment = (text: string) =>
  getDashSeparatedSegments(text).length > 1
    ? getDashSeparatedSegments(text)[0]
    : text.trim()

export const guessAlbumFromFilename = (filePath: string) =>
  pickAlbumSegment(
    stripLeadingTrackNumber(
      basename(filePath, extname(filePath)),
    ),
  )

const deriveAlbumNameFromPath = (filePath: string) =>
  GENERIC_DIRECTORY_NAMES.includes(
    getParentDirectoryName(filePath).toLowerCase(),
  )
    ? guessAlbumFromFilename(filePath)
    : getParentDirectoryName(filePath)

// Tags first, then the parent directory, then the filename guess.
export const deriveAlbumName = (
  file: AudioFileForClustering,
) =>
  getTrimmedTag(file.tags.album) ||
  deriveAlbumNameFromPath(file.filePath)

// The cluster key is the album name alone. The artist is deliberately NOT part
// of it: one file in an album is routinely missing its album-artist tag, and a
// compilation has a different artist on every track. Picard labels the cluster
// with an artist; it does not split on one.
const getClusterKey = (file: AudioFileForClustering) =>
  deriveAlbumName(file).toLowerCase()

const getPresentArtistNames = ({
  files,
  tagName,
}: {
  files: AudioFileForClustering[]
  tagName: "albumArtist" | "artist"
}) =>
  files
    .map((file) => getTrimmedTag(file.tags[tagName]))
    .filter((artistName) => artistName.length > 0)

// One shared track artist labels the cluster with that artist; several make it
// a compilation, which Picard files under `va_name`.
const labelTrackArtists = (artistNames: string[]) =>
  artistNames.length === 0
    ? ""
    : new Set(artistNames).size === 1
      ? artistNames[0]
      : VARIOUS_ARTISTS_NAME

const pickClusterAlbumArtist = (
  files: AudioFileForClustering[],
) =>
  getPresentArtistNames({
    files,
    tagName: "albumArtist",
  }).at(0) ??
  labelTrackArtists(
    getPresentArtistNames({ files, tagName: "artist" }),
  )

const compareFiles = (
  firstFile: AudioFileForClustering,
  secondFile: AudioFileForClustering,
) =>
  (firstFile.tags.discNumber ?? 1) -
    (secondFile.tags.discNumber ?? 1) ||
  (firstFile.tags.trackNumber ?? Number.MAX_SAFE_INTEGER) -
    (secondFile.tags.trackNumber ??
      Number.MAX_SAFE_INTEGER) ||
  firstFile.filePath.localeCompare(secondFile.filePath)

const buildCluster = (
  sortedFiles: AudioFileForClustering[],
): AudioFileCluster => ({
  album: deriveAlbumName(sortedFiles[0]),
  albumArtist: pickClusterAlbumArtist(sortedFiles),
  files: sortedFiles,
  trackCount: sortedFiles.length,
})

export const clusterAudioFiles = ({
  files,
}: {
  files: AudioFileForClustering[]
}): AudioFileCluster[] =>
  Array.from(
    files
      .reduce(
        (
          clustersByKey: Map<
            string,
            AudioFileForClustering[]
          >,
          file,
        ) =>
          clustersByKey.set(
            getClusterKey(file),
            (
              clustersByKey.get(getClusterKey(file)) ?? []
            ).concat([file]),
          ),
        new Map<string, AudioFileForClustering[]>(),
      )
      .values(),
  )
    .map((clusteredFiles) =>
      buildCluster(clusteredFiles.toSorted(compareFiles)),
    )
    .toSorted(
      (firstCluster, secondCluster) =>
        firstCluster.albumArtist.localeCompare(
          secondCluster.albumArtist,
        ) ||
        firstCluster.album.localeCompare(
          secondCluster.album,
        ),
    )
