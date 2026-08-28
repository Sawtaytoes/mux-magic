import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, from, map, of, toArray } from "rxjs"

import {
  buildProposedTags,
  getReleaseTracksForMatching,
  getTrackArtistCredit,
} from "../music/matching/buildProposedTags.js"
import {
  matchReleaseTracksToFiles,
  type TrackFileMatch,
} from "../music/matching/matchReleaseTracksToFiles.js"
import type { AudioTags } from "../music/tags/audioTagFields.js"
import {
  type AudioFileCluster,
  clusterAudioFiles,
} from "../tools/clusterAudioFiles.js"
import {
  type CachedFetch,
  getMusicBrainzRelease,
  type MusicBrainzRelease,
  searchMusicBrainzReleases,
} from "../tools/musicBrainzApi.js"
import { musicBrainzCachedFetch } from "../tools/musicProviderFetchers.js"
import {
  rankReleaseCandidates,
  type ScoredReleaseCandidate,
} from "../tools/rankReleaseCandidates.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// Phase 2 of the Picard replacement: Cluster, then Lookup.
//
// The command does no writing. It produces the ranked candidate set the
// review table renders, and the table is where a human accepts it. That
// split is deliberate — `docs/picard-parity.md` §7.6 records that a blind
// CLI run was rejected, and the tag difference view is the reason.
//
// Two round trips per cluster, and no more than that on purpose.
// MusicBrainz allows one request per second and blocks the address that
// exceeds it, so the search result (which carries no track list) ranks the
// candidates and only the top few are fetched in full.

// How many ranked releases are fetched in full and offered per row. Picard
// shows a comparable shortlist in its manual release search. Five is enough
// for the "wrong country / wrong year" correction that is the common case,
// and costs five seconds of rate limit per cluster.
export const DEFAULT_CANDIDATE_FETCH_LIMIT = 5

// Release score and track score contribute equally. A perfect release match
// says nothing about whether THIS file is track 4, and a perfect track match
// on the wrong release is worse than useless.
export const RELEASE_SCORE_WEIGHT = 0.5
export const TRACK_SCORE_WEIGHT = 0.5

export type MusicMatchReleaseCandidate = {
  artistName: string
  country?: string
  format?: string
  label?: string
  releaseId: string
  releaseTitle: string
  // Both providers, because both feed the SAME review table. The web
  // mirror of this type (`ReleaseCandidate` in `tagMatchTypes.ts`) has
  // carried the pair since it was written; the server side only caught up
  // when `matchVgmdbRelease` was built.
  source: "freedb" | "musicbrainz" | "vgmdb"
  trackCount?: number
  year?: string
}

export type MusicMatchScoredCandidate = {
  candidate: MusicMatchReleaseCandidate
  confidence: number
  proposedTags: AudioTags
}

export type MusicMatchFileRecord = {
  currentTags: AudioTags
  durationSeconds: number | null
  extension: string
  filePath: string
  filename: string
  rankedCandidates: MusicMatchScoredCandidate[]
}

export type MusicMatchClusterRecord = {
  album: string
  albumArtist: string
  files: MusicMatchFileRecord[]
  isMusicMatch: true
  kind: "cluster"
  trackCount: number
}

export type MatchMusicBrainzReleaseProps = {
  candidateFetchLimit?: number
  cachedFetch?: CachedFetch
  isRecursive?: boolean
  recursiveDepth?: number
  releaseId?: string
  sourcePath: string
}

const getReleaseYear = (release: MusicBrainzRelease) =>
  release.date.slice(0, 4) || undefined

const undefinedWhenEmpty = (value: string | undefined) =>
  value !== undefined && value.trim().length > 0
    ? value
    : undefined

const toMatchCandidate = (
  release: MusicBrainzRelease,
): MusicMatchReleaseCandidate => ({
  artistName: release.artistCredit
    .map((part) => part.name)
    .join(", "),
  country: undefinedWhenEmpty(release.country),
  format: undefinedWhenEmpty(release.formats.at(0)),
  label: undefinedWhenEmpty(release.labels.at(0)),
  releaseId: release.releaseId,
  releaseTitle: release.title,
  source: "musicbrainz",
  trackCount: release.trackCount,
  year: getReleaseYear(release),
})

const toRankingFile = (
  record: ScanAudioFilesScannedRecord,
) => ({
  album: record.tags.album,
  albumArtist: record.tags.albumArtist,
  artist: record.tags.artist,
  discNumber: record.tags.discNumber,
  durationSeconds: record.info.durationSeconds,
  title: record.tags.title,
  trackNumber: record.tags.trackNumber,
})

const toTrackMatchingFile = (
  record: ScanAudioFilesScannedRecord,
) => ({
  discNumber: record.tags.discNumber,
  durationSeconds: record.info.durationSeconds,
  filePath: record.filePath,
  title: record.tags.title,
  trackNumber: record.tags.trackNumber,
})

// One fully-fetched release, matched track-by-track against the cluster's
// files. Returns a map so the per-file assembly below is a lookup rather
// than a second scan.
const buildCandidateForRelease = ({
  files,
  release,
  releaseScore,
}: {
  files: ScanAudioFilesScannedRecord[]
  release: MusicBrainzRelease
  releaseScore: number
}) =>
  ((matches: TrackFileMatch[]) =>
    matches.reduce(
      (
        candidatesByFilePath: Map<
          string,
          MusicMatchScoredCandidate
        >,
        match,
      ) =>
        match.track === null
          ? candidatesByFilePath
          : candidatesByFilePath.set(match.filePath, {
              candidate: toMatchCandidate(release),
              confidence:
                releaseScore * RELEASE_SCORE_WEIGHT +
                match.matchConfidence * TRACK_SCORE_WEIGHT,
              proposedTags: buildProposedTags({
                release,
                track: match.track,
                trackArtistCredit: getTrackArtistCredit({
                  release,
                  track: match.track,
                }),
              }),
            }),
      new Map<string, MusicMatchScoredCandidate>(),
    ))(
    matchReleaseTracksToFiles({
      files: files.map(toTrackMatchingFile),
      tracks: getReleaseTracksForMatching(release),
    }),
  )

const assembleClusterRecord = ({
  candidateMaps,
  cluster,
  filesByPath,
}: {
  candidateMaps: Map<string, MusicMatchScoredCandidate>[]
  cluster: AudioFileCluster
  filesByPath: Map<string, ScanAudioFilesScannedRecord>
}): MusicMatchClusterRecord => ({
  album: cluster.album,
  albumArtist: cluster.albumArtist,
  files: cluster.files
    .map((clusterFile) =>
      filesByPath.get(clusterFile.filePath),
    )
    .filter(
      (record): record is ScanAudioFilesScannedRecord =>
        record !== undefined,
    )
    .map((record) => ({
      currentTags: record.tags,
      durationSeconds: record.info.durationSeconds ?? null,
      extension: record.extension,
      filePath: record.filePath,
      filename: record.filename,
      rankedCandidates: candidateMaps
        .map((candidatesByFilePath) =>
          candidatesByFilePath.get(record.filePath),
        )
        .filter(
          (scored): scored is MusicMatchScoredCandidate =>
            scored !== undefined,
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
  candidateFetchLimit,
  cluster,
  filesByPath,
  releaseId,
}: {
  cachedFetch: CachedFetch
  candidateFetchLimit: number
  cluster: AudioFileCluster
  filesByPath: Map<string, ScanAudioFilesScannedRecord>
  releaseId?: string
}) =>
  ((clusterRecords: ScanAudioFilesScannedRecord[]) =>
    // ⚠️ The cluster's track count is deliberately NOT sent.
    // `buildReleaseSearchQuery` renders it as `AND tracks:<n>`, which is a
    // hard Lucene filter, so a folder holding 2 tracks of a 16-track album
    // matches ZERO releases and the row set comes back with no candidates
    // at all. A partial or mis-tagged folder is the case this tagger exists
    // for, so that is the wrong bar to fail at. Track count is already a
    // ranking signal — `TRACK_COUNT_WEIGHT` in `rankReleaseCandidates` — so
    // a release with the wrong count still places below one with the right
    // count instead of vanishing.
    (releaseId
      ? getMusicBrainzRelease({
          cachedFetch,
          releaseId,
        }).pipe(
          map((release) => [
            buildCandidateForRelease({
              files: clusterRecords,
              release,
              releaseScore: 1,
            }),
          ]),
        )
      : searchMusicBrainzReleases({
          albumName: cluster.album,
          artistName: cluster.albumArtist,
          cachedFetch,
        }).pipe(
          map((releases) =>
            rankReleaseCandidates({
              candidates: releases,
              files: clusterRecords.map(toRankingFile),
            }).slice(0, candidateFetchLimit),
          ),
          concatMap(
            (shortlist: ScoredReleaseCandidate[]) =>
              shortlist.length === 0
                ? of([])
                : from(shortlist).pipe(
                    concatMap((scored) =>
                      getMusicBrainzRelease({
                        cachedFetch,
                        releaseId:
                          scored.candidate.releaseId,
                      }).pipe(
                        map((release) =>
                          buildCandidateForRelease({
                            files: clusterRecords,
                            release,
                            releaseScore:
                              scored.matchConfidence,
                          }),
                        ),
                      ),
                    ),
                    toArray(),
                  ),
          ),
        )
    ).pipe(
      map((candidateMaps) =>
        assembleClusterRecord({
          candidateMaps,
          cluster,
          filesByPath,
        }),
      ),
    ))(
    cluster.files
      .map((clusterFile) =>
        filesByPath.get(clusterFile.filePath),
      )
      .filter(
        (record): record is ScanAudioFilesScannedRecord =>
          record !== undefined,
      ),
  )

export const matchMusicBrainzRelease = ({
  cachedFetch = musicBrainzCachedFetch,
  candidateFetchLimit = DEFAULT_CANDIDATE_FETCH_LIMIT,
  isRecursive = false,
  recursiveDepth = 1,
  releaseId,
  sourcePath,
}: MatchMusicBrainzReleaseProps) =>
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
            "matchMusicBrainzRelease",
            `${scannedRecords.length} audio files in ${clusters.length} clusters.`,
          )
          return clusters.length === 0
            ? of<MusicMatchClusterRecord[]>([])
            : from(clusters).pipe(
                concatMap((cluster) =>
                  matchOneCluster({
                    cachedFetch,
                    candidateFetchLimit,
                    cluster,
                    filesByPath,
                    releaseId,
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
    logAndRethrowPipelineError(matchMusicBrainzRelease),
  )
