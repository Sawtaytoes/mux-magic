import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, from, map, of, toArray } from "rxjs"
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
  type DiscogsRelease,
  discogsArtistName,
  getDiscogsRelease,
  searchDiscogsReleases,
} from "../tools/discogsApi.js"
import type { CachedFetch } from "../tools/musicBrainzApi.js"
import { discogsCachedFetch } from "../tools/musicProviderFetchers.js"
import {
  rankReleaseCandidates,
  type ScoredReleaseCandidate,
} from "../tools/rankReleaseCandidates.js"
import type {
  MusicMatchClusterRecord,
  MusicMatchFileRecord,
  MusicMatchReleaseCandidate,
  MusicMatchScoredCandidate,
} from "./matchMusicBrainzRelease.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// Discogs has no CDDB endpoint. Its release database is searched from the
// cluster's artist and album, then full releases are matched track-by-track.
// That gives it the same reviewed result shape as MusicBrainz without
// pretending a Discogs release has MusicBrainz identifiers.
export const DEFAULT_DISCOGS_CANDIDATE_FETCH_LIMIT = 5
export const RELEASE_SCORE_WEIGHT = 0.5
export const TRACK_SCORE_WEIGHT = 0.5

export type MatchDiscogsReleaseProps = {
  cachedFetch?: CachedFetch
  candidateFetchLimit?: number
  isRecursive?: boolean
  recursiveDepth?: number
  sourcePath: string
}

const undefinedWhenEmpty = (value: string) =>
  value.trim().length > 0 ? value : undefined

const toMatchCandidate = (
  release: DiscogsRelease,
): MusicMatchReleaseCandidate => ({
  artistName: discogsArtistName(release),
  country: undefinedWhenEmpty(release.country),
  format: release.formats.at(0),
  label: release.labels.at(0),
  releaseId: release.releaseId,
  releaseTitle: release.title,
  source: "discogs",
  trackCount: release.trackCount,
  year: undefinedWhenEmpty(release.year),
})

const toRankingCandidate = (release: DiscogsRelease) => ({
  artistCredit: release.artistCredit,
  country: release.country,
  formats: release.formats,
  media: [
    {
      discNumber: 1,
      tracks: release.tracks.map((track) => ({
        lengthMilliseconds: track.lengthMilliseconds,
        position: track.position,
        title: track.title,
      })),
    },
  ],
  primaryType: "",
  releaseId: release.releaseId,
  secondaryTypes: [],
  title: release.title,
  trackCount: release.trackCount,
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

const buildProposedTags = ({
  release,
  track,
}: {
  release: DiscogsRelease
  track: DiscogsRelease["tracks"][number]
}): AudioTags => ({
  album: undefinedWhenEmpty(release.title),
  albumArtist: undefinedWhenEmpty(
    discogsArtistName(release),
  ),
  artist: undefinedWhenEmpty(
    discogsArtistName({
      ...release,
      artistCredit:
        track.artistCredit.length > 0
          ? track.artistCredit
          : release.artistCredit,
    }),
  ),
  date: undefinedWhenEmpty(release.year),
  discNumber: track.discNumber,
  genres:
    release.genres.length > 0 ? release.genres : undefined,
  title: undefinedWhenEmpty(track.title),
  totalDiscs: new Set(
    release.tracks.map(
      (releaseTrack) => releaseTrack.discNumber,
    ),
  ).size,
  totalTracks: release.tracks.filter(
    (releaseTrack) =>
      releaseTrack.discNumber === track.discNumber,
  ).length,
  trackNumber: track.position,
})

const getDiscogsTrack = ({
  release,
  match,
}: {
  release: DiscogsRelease
  match: TrackFileMatch
}) =>
  match.track === null
    ? undefined
    : release.tracks.find(
        (track) =>
          track.discNumber === match.track?.discNumber &&
          track.position === match.track?.position,
      )

const buildCandidateForRelease = ({
  files,
  release,
  releaseScore,
}: {
  files: ScanAudioFilesScannedRecord[]
  release: DiscogsRelease
  releaseScore: number
}) =>
  matchReleaseTracksToFiles({
    files: files.map(toTrackMatchingFile),
    tracks: release.tracks.map((track) => ({
      discNumber: track.discNumber,
      lengthMilliseconds: track.lengthMilliseconds,
      position: track.position,
      recordingId: "",
      title: track.title,
      totalTracksOnMedium: release.tracks.filter(
        (releaseTrack) =>
          releaseTrack.discNumber === track.discNumber,
      ).length,
    })),
  }).reduce(
    (
      candidatesByFilePath: Map<
        string,
        MusicMatchScoredCandidate
      >,
      match,
    ) =>
      ((track) =>
        track === undefined
          ? candidatesByFilePath
          : candidatesByFilePath.set(match.filePath, {
              candidate: toMatchCandidate(release),
              confidence:
                releaseScore * RELEASE_SCORE_WEIGHT +
                match.matchConfidence * TRACK_SCORE_WEIGHT,
              proposedTags: buildProposedTags({
                release,
                track,
              }),
            }))(getDiscogsTrack({ release, match })),
    new Map<string, MusicMatchScoredCandidate>(),
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
    .map(
      (record): MusicMatchFileRecord => ({
        currentTags: record.tags,
        durationSeconds:
          record.info.durationSeconds ?? null,
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
      }),
    ),
  isMusicMatch: true,
  kind: "cluster",
  trackCount: cluster.trackCount,
})

const matchOneCluster = ({
  cachedFetch,
  candidateFetchLimit,
  cluster,
  filesByPath,
}: {
  cachedFetch: CachedFetch
  candidateFetchLimit: number
  cluster: AudioFileCluster
  filesByPath: Map<string, ScanAudioFilesScannedRecord>
}) =>
  ((records: ScanAudioFilesScannedRecord[]) =>
    searchDiscogsReleases({
      albumName: cluster.album,
      artistName: cluster.albumArtist,
      cachedFetch,
    }).pipe(
      map((releases) =>
        rankReleaseCandidates({
          candidates: releases.map(toRankingCandidate),
          files: records.map(toRankingFile),
        }).slice(0, candidateFetchLimit),
      ),
      concatMap((shortlist: ScoredReleaseCandidate[]) =>
        shortlist.length === 0
          ? of([])
          : from(shortlist).pipe(
              concatMap((scored) =>
                getDiscogsRelease({
                  cachedFetch,
                  releaseId: scored.candidate.releaseId,
                }).pipe(
                  map((release) =>
                    buildCandidateForRelease({
                      files: records,
                      release,
                      releaseScore: scored.matchConfidence,
                    }),
                  ),
                ),
              ),
              toArray(),
            ),
      ),
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

export const matchDiscogsRelease = ({
  cachedFetch = discogsCachedFetch,
  candidateFetchLimit = DEFAULT_DISCOGS_CANDIDATE_FETCH_LIMIT,
  isRecursive = false,
  recursiveDepth = 1,
  sourcePath,
}: MatchDiscogsReleaseProps) =>
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
            "matchDiscogsRelease",
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
    logAndRethrowPipelineError(matchDiscogsRelease),
  )
