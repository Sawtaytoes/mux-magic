import { basename } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, from, map, of, toArray } from "rxjs"

import type { AudioTags } from "../music/tags/audioTagFields.js"
import {
  type CddbServer,
  queryVgmdbCddb,
  readVgmdbCddbAlbum,
  VGMDB_CDDB_SERVER,
  type VgmdbCddbAlbum,
  type VgmdbCddbLanguage,
  type VgmdbCddbMatch,
} from "../tools/cddbApi.js"
import {
  type AudioFileCluster,
  clusterAudioFiles,
} from "../tools/clusterAudioFiles.js"
import type { CachedFetch } from "../tools/musicBrainzApi.js"
import { vgmdbCddbCachedFetch } from "../tools/musicProviderFetchers.js"
import { scoreTextSimilarity } from "../tools/rankReleaseCandidates.js"
import type {
  MusicMatchClusterRecord,
  MusicMatchScoredCandidate,
} from "./matchMusicBrainzRelease.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// Phase 6 of the Picard replacement: the game and anime soundtracks
// MusicBrainz covers badly. This is the MP3Tag script being replaced.
//
// It emits the SAME cluster record shape as `matchMusicBrainzRelease`, so
// the tag review table renders it with no UI work at all — the web
// candidate type has carried `source: "musicbrainz" | "vgmdb"` since it
// was written.
//
// ⚠️ Two things about the freedb protocol decide how this command behaves,
// and neither is a choice we made:
//
// 1. **A disc is identified by its track count and total playing time.**
//    Not by its name, not by its tags. So the files must be in TRACK
//    ORDER and the folder must be ONE disc. A flattened two-disc set
//    matches nothing, and that is reported rather than hidden.
// 2. **A VGMdb track carries no track number.** Its position in the
//    returned list IS its number, so proposals are assigned by position.

// Read in full and offered per row. Each costs one request, and the
// common case — the same album released in three regions — is settled by
// looking at two or three.
export const DEFAULT_VGMDB_CANDIDATE_LIMIT = 4

// An exact freedb answer (`200`) means the disc id matched outright. An
// inexact list (`211`) means the server matched on count and playtime but
// not the exact id, which is the normal answer for a rip whose track
// lengths differ by a few frames. Both are real matches; the exact one is
// worth more.
export const EXACT_MATCH_CONFIDENCE = 0.9
export const INEXACT_MATCH_CONFIDENCE = 0.75

// How much the existing titles can move the score. The disc already
// matched on duration, so titles confirm rather than decide.
export const TITLE_CONFIRMATION_WEIGHT = 0.2

export type MatchVgmdbReleaseProps = {
  cachedFetch?: CachedFetch
  candidateLimit?: number
  isRecursive?: boolean
  language?: VgmdbCddbLanguage
  recursiveDepth?: number
  sourcePath: string
  vgmdbAlbumId?: string
}

// Both CDDB-backed commands run this identical pipeline. They differ in
// the server they ask and the label the review table shows, and in
// nothing else — so they share one implementation rather than two copies
// that drift.
export type MatchCddbReleaseProps =
  MatchVgmdbReleaseProps & {
    server?: CddbServer
    sourceLabel?: "freedb" | "vgmdb"
  }

// Track order, and the tags are trusted over the filename when they carry
// a number. The disc id is computed from this order, so getting it wrong
// produces a different id and no match at all.
const orderClusterFiles = (
  records: ScanAudioFilesScannedRecord[],
) =>
  records.toSorted(
    (firstRecord, secondRecord) =>
      (firstRecord.tags.discNumber ?? 1) -
        (secondRecord.tags.discNumber ?? 1) ||
      (firstRecord.tags.trackNumber ?? 0) -
        (secondRecord.tags.trackNumber ?? 0) ||
      basename(firstRecord.filePath).localeCompare(
        basename(secondRecord.filePath),
      ),
  )

const toCandidate = ({
  album,
  sourceLabel,
}: {
  album: VgmdbCddbAlbum
  sourceLabel: "freedb" | "vgmdb"
}) => ({
  artistName: album.artistName,
  // freedb has no album id of its own, so the disc id is the only stable
  // handle a row can carry. Leaving it empty would make every candidate
  // look like the same release to the table's sort and de-duplication.
  releaseId:
    album.vgmdbAlbumId.length > 0
      ? album.vgmdbAlbumId
      : `${album.category}:${album.discId}`,
  releaseTitle: album.albumTitle,
  source: sourceLabel,
  trackCount: album.trackTitles.length,
  year: album.year.length > 0 ? album.year : undefined,
})

// VGMdb's CDDB view gives a title per position, a year and a genre, and
// nothing else. It carries no per-track artist and no recording id, so a
// proposal is deliberately narrow — the fields it cannot know are left
// absent rather than filled with a guess, and an absent field means
// "leave what is there" all the way down to the writer.
const buildVgmdbProposedTags = ({
  album,
  trackIndex,
}: {
  album: VgmdbCddbAlbum
  trackIndex: number
}): AudioTags => ({
  album:
    album.albumTitle.length > 0
      ? album.albumTitle
      : undefined,
  albumArtist:
    album.artistName.length > 0
      ? album.artistName
      : undefined,
  date: album.year.length > 0 ? album.year : undefined,
  genres:
    album.genre.length > 0 ? [album.genre] : undefined,
  title: album.trackTitles[trackIndex],
  totalTracks: album.trackTitles.length,
  trackNumber: trackIndex + 1,
})

// The disc matched on duration before any title was compared, so titles
// only nudge the score. A folder with no titles at all keeps the base
// confidence rather than being punished for what it does not have.
const scoreAgainstExistingTitles = ({
  album,
  records,
}: {
  album: VgmdbCddbAlbum
  records: ScanAudioFilesScannedRecord[]
}) =>
  ((comparableTitles: number[]) =>
    comparableTitles.length === 0
      ? null
      : comparableTitles.reduce(
          (total, score) => total + score,
          0,
        ) / comparableTitles.length)(
    records
      .map((record, recordIndex) => ({
        existingTitle: record.tags.title ?? "",
        proposedTitle: album.trackTitles[recordIndex] ?? "",
      }))
      .filter(
        ({ existingTitle, proposedTitle }) =>
          existingTitle.length > 0 &&
          proposedTitle.length > 0,
      )
      .map(({ existingTitle, proposedTitle }) =>
        scoreTextSimilarity({
          leftText: existingTitle,
          rightText: proposedTitle,
        }),
      ),
  )

const buildCandidateConfidence = ({
  album,
  baseConfidence,
  records,
}: {
  album: VgmdbCddbAlbum
  baseConfidence: number
  records: ScanAudioFilesScannedRecord[]
}) =>
  ((titleScore: number | null) =>
    titleScore === null
      ? baseConfidence
      : baseConfidence * (1 - TITLE_CONFIRMATION_WEIGHT) +
        titleScore * TITLE_CONFIRMATION_WEIGHT)(
    scoreAgainstExistingTitles({ album, records }),
  )

const buildScoredCandidate = ({
  album,
  baseConfidence,
  records,
  sourceLabel,
  trackIndex,
}: {
  album: VgmdbCddbAlbum
  baseConfidence: number
  records: ScanAudioFilesScannedRecord[]
  sourceLabel: "freedb" | "vgmdb"
  trackIndex: number
}): MusicMatchScoredCandidate => ({
  candidate: toCandidate({ album, sourceLabel }),
  confidence: buildCandidateConfidence({
    album,
    baseConfidence,
    records,
  }),
  proposedTags: buildVgmdbProposedTags({
    album,
    trackIndex,
  }),
})

const assembleClusterRecord = ({
  albums,
  baseConfidence,
  cluster,
  records,
  sourceLabel,
}: {
  albums: VgmdbCddbAlbum[]
  baseConfidence: number
  cluster: AudioFileCluster
  records: ScanAudioFilesScannedRecord[]
  sourceLabel: "freedb" | "vgmdb"
}): MusicMatchClusterRecord => ({
  album: cluster.album,
  albumArtist: cluster.albumArtist,
  files: records.map((record, recordIndex) => ({
    currentTags: record.tags,
    durationSeconds: record.info.durationSeconds ?? null,
    extension: record.extension,
    filePath: record.filePath,
    filename: record.filename,
    rankedCandidates: albums
      // A release with fewer tracks than this folder has cannot name
      // this file, so it is not offered for that row.
      .filter(
        (album) => recordIndex < album.trackTitles.length,
      )
      .map((album) =>
        buildScoredCandidate({
          album,
          baseConfidence,
          records,
          sourceLabel,
          trackIndex: recordIndex,
        }),
      )
      .toSorted(
        (firstScored, secondScored) =>
          secondScored.confidence -
            firstScored.confidence ||
          firstScored.candidate.releaseId.localeCompare(
            secondScored.candidate.releaseId,
          ),
      ),
  })),
  isMusicMatch: true,
  kind: "cluster",
  trackCount: cluster.trackCount,
})

const matchOneCluster = ({
  cachedFetch,
  candidateLimit,
  cluster,
  filesByPath,
  language,
  server,
  sourceLabel,
  vgmdbAlbumId,
}: {
  cachedFetch: CachedFetch
  candidateLimit: number
  cluster: AudioFileCluster
  filesByPath: Map<string, ScanAudioFilesScannedRecord>
  language: VgmdbCddbLanguage
  server: CddbServer
  sourceLabel: "freedb" | "vgmdb"
  vgmdbAlbumId?: string
}) =>
  ((records: ScanAudioFilesScannedRecord[]) =>
    // A file with no readable duration cannot contribute an offset, and
    // one wrong offset changes the disc id. Refusing outright beats
    // sending a query that can only mismatch.
    records.some(
      (record) =>
        typeof record.info.durationSeconds !== "number",
    )
      ? of(
          assembleClusterRecord({
            albums: [],
            baseConfidence: 0,
            cluster,
            records,
            sourceLabel,
          }),
        )
      : queryVgmdbCddb({
          cachedFetch,
          language,
          server,
          trackLengthsSeconds: records.map(
            (record) => record.info.durationSeconds ?? 0,
          ),
        }).pipe(
          concatMap((matches: VgmdbCddbMatch[]) =>
            matches.length === 0
              ? of({
                  albums: [] as VgmdbCddbAlbum[],
                  baseConfidence: 0,
                })
              : from(
                  vgmdbAlbumId
                    ? matches
                    : matches.slice(0, candidateLimit),
                ).pipe(
                  concatMap((match) =>
                    readVgmdbCddbAlbum({
                      cachedFetch,
                      category: match.category,
                      discId: match.discId,
                      language,
                      server,
                    }),
                  ),
                  toArray(),
                  map((albums) => ({
                    albums: vgmdbAlbumId
                      ? albums.filter(
                          (album) =>
                            album.vgmdbAlbumId ===
                            vgmdbAlbumId,
                        )
                      : albums,
                    baseConfidence:
                      matches.length === 1
                        ? EXACT_MATCH_CONFIDENCE
                        : INEXACT_MATCH_CONFIDENCE,
                  })),
                ),
          ),
          map(({ albums, baseConfidence }) =>
            assembleClusterRecord({
              albums,
              baseConfidence,
              cluster,
              records,
              sourceLabel,
            }),
          ),
        ))(
    orderClusterFiles(
      cluster.files
        .map((clusterFile) =>
          filesByPath.get(clusterFile.filePath),
        )
        .filter(
          (record): record is ScanAudioFilesScannedRecord =>
            record !== undefined,
        ),
    ),
  )

export const matchCddbRelease = ({
  cachedFetch = vgmdbCddbCachedFetch,
  candidateLimit = DEFAULT_VGMDB_CANDIDATE_LIMIT,
  isRecursive = false,
  language = "default",
  recursiveDepth = 1,
  server = VGMDB_CDDB_SERVER,
  sourceLabel = "vgmdb",
  sourcePath,
  vgmdbAlbumId,
}: MatchCddbReleaseProps) =>
  scanAudioFiles({
    isRecursive,
    recursiveDepth,
    sourcePath,
  }).pipe(
    map((records) =>
      records.filter(
        (record): record is ScanAudioFilesScannedRecord =>
          record.kind === "scanned",
      ),
    ),
    concatMap((scannedRecords) =>
      ((
        filesByPath: Map<
          string,
          ScanAudioFilesScannedRecord
        >,
      ) =>
        ((clusters: AudioFileCluster[]) => {
          logInfo(
            "matchCddbRelease",
            `${scannedRecords.length} audio files in ${clusters.length} clusters. ${server.name} matches a whole disc by track count and total playing time, so a folder holding more than one disc will not match.`,
          )
          return clusters.length === 0
            ? of<MusicMatchClusterRecord[]>([])
            : from(clusters).pipe(
                concatMap((cluster) =>
                  matchOneCluster({
                    cachedFetch,
                    candidateLimit,
                    cluster,
                    filesByPath,
                    language,
                    server,
                    sourceLabel,
                    vgmdbAlbumId,
                  }),
                ),
                toArray(),
              )
        })(
          clusterAudioFiles({
            files: scannedRecords.map((record) => ({
              filePath: record.filePath,
              tags: record.tags,
            })),
          }),
        ))(
        new Map(
          scannedRecords.map((record) => [
            record.filePath,
            record,
          ]),
        ),
      ),
    ),
    logAndRethrowPipelineError(matchCddbRelease),
  )

export const matchVgmdbRelease = (
  props: MatchVgmdbReleaseProps,
) =>
  matchCddbRelease({
    ...props,
    server: VGMDB_CDDB_SERVER,
    sourceLabel: "vgmdb",
  })
