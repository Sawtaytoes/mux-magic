import {
  logAndRethrowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import {
  catchError,
  concat,
  map,
  type Observable,
  of,
  toArray,
} from "rxjs"

import type { VgmdbCddbLanguage } from "../tools/cddbApi.js"
import { matchFreedbRelease } from "./matchFreedbRelease.js"
import {
  type MusicMatchClusterRecord,
  type MusicMatchScoredCandidate,
  matchMusicBrainzRelease,
} from "./matchMusicBrainzRelease.js"
import { matchVgmdbRelease } from "./matchVgmdbRelease.js"

// The provider-neutral matcher. It asks every provider in the settled
// order, keeps a failure in one provider from hiding the other two, and
// returns one review row per file with all candidates ranked together.
// It remains read-only. The review table is still the only place a
// candidate becomes a tag write.

export const MUSIC_RELEASE_PROVIDER_ORDER = [
  "musicbrainz",
  "vgmdb",
  "freedb",
] as const

export type MatchMusicReleaseProps = {
  isRecursive?: boolean
  language?: VgmdbCddbLanguage
  recursiveDepth?: number
  sourcePath: string
}

const getClusterKey = (cluster: MusicMatchClusterRecord) =>
  cluster.files
    .map((file) => file.filePath)
    .toSorted()
    .join("\u0000")

const getProviderOrder = (
  scored: MusicMatchScoredCandidate,
) =>
  MUSIC_RELEASE_PROVIDER_ORDER.indexOf(
    scored.candidate.source,
  )

const getSortableConfidence = (
  scored: MusicMatchScoredCandidate,
) =>
  Number.isFinite(scored.confidence) ? scored.confidence : 0

const sortCandidates = (
  candidates: MusicMatchScoredCandidate[],
) =>
  candidates.toSorted(
    (firstScored, secondScored) =>
      getSortableConfidence(secondScored) -
        getSortableConfidence(firstScored) ||
      getProviderOrder(firstScored) -
        getProviderOrder(secondScored) ||
      firstScored.candidate.releaseId.localeCompare(
        secondScored.candidate.releaseId,
      ),
  )

const mergeClusterGroup = (
  clusters: MusicMatchClusterRecord[],
): MusicMatchClusterRecord =>
  ((firstCluster: MusicMatchClusterRecord) => ({
    ...firstCluster,
    files: firstCluster.files.map((file) => ({
      ...file,
      rankedCandidates: sortCandidates(
        clusters.flatMap(
          (cluster) =>
            cluster.files.find(
              (candidateFile) =>
                candidateFile.filePath === file.filePath,
            )?.rankedCandidates ?? [],
        ),
      ),
    })),
  }))(clusters[0] as MusicMatchClusterRecord)

export const mergeMusicMatchClusters = (
  resultSets: MusicMatchClusterRecord[][],
): MusicMatchClusterRecord[] =>
  ((allClusters: MusicMatchClusterRecord[]) =>
    allClusters
      .map(getClusterKey)
      .filter(
        (clusterKey, clusterIndex, clusterKeys) =>
          clusterKeys.indexOf(clusterKey) === clusterIndex,
      )
      .map((clusterKey) =>
        mergeClusterGroup(
          allClusters.filter(
            (cluster) =>
              getClusterKey(cluster) === clusterKey,
          ),
        ),
      ))(resultSets.flat())

const continueAfterProviderError = ({
  error,
  provider,
}: {
  error: unknown
  provider: string
}) => {
  logWarning(
    "matchMusicRelease",
    `${provider} failed: ${error instanceof Error ? error.message : String(error)}. The remaining providers will still run.`,
  )
  return of<MusicMatchClusterRecord[]>([])
}

const protectProvider = ({
  provider,
  results,
}: {
  provider: string
  results: Observable<MusicMatchClusterRecord[]>
}) =>
  results.pipe(
    catchError((error: unknown) =>
      continueAfterProviderError({ error, provider }),
    ),
  )

export const matchMusicRelease = ({
  isRecursive = false,
  language = "default",
  recursiveDepth = 1,
  sourcePath,
}: MatchMusicReleaseProps) => {
  logInfo(
    "matchMusicRelease",
    "Trying MusicBrainz, VGMdb, then freedb.",
  )
  return concat(
    protectProvider({
      provider: "MusicBrainz",
      results: matchMusicBrainzRelease({
        isRecursive,
        recursiveDepth,
        sourcePath,
      }),
    }),
    protectProvider({
      provider: "VGMdb",
      results: matchVgmdbRelease({
        isRecursive,
        language,
        recursiveDepth,
        sourcePath,
      }),
    }),
    protectProvider({
      provider: "freedb",
      results: matchFreedbRelease({
        isRecursive,
        recursiveDepth,
        sourcePath,
      }),
    }),
  ).pipe(
    toArray(),
    map(mergeMusicMatchClusters),
    logAndRethrowPipelineError(matchMusicRelease),
  )
}
