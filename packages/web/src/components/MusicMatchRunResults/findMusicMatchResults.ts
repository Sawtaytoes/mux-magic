import type {
  ScoredReleaseCandidate,
  TagMatchFile,
} from "../TagMatchModal/tagMatchTypes"

// Type guards + finders for the `matchMusicBrainzRelease` pipeline's
// `payload.results` stream. Same pattern `findNsfResults.ts` uses for the
// NSF summary: a narrowed mirror of the server shape, so unrelated server
// changes do not ripple into web typecheck.
//
// Source of truth: `MusicMatchClusterRecord` in
// `packages/core/src/app-commands/matchMusicBrainzRelease.ts`.

export type MusicMatchClusterRecord = {
  album: string
  albumArtist: string
  files: TagMatchFile[]
  isMusicMatch: true
  trackCount: number
}

export const isMusicMatchCluster = (
  entry: unknown,
): entry is MusicMatchClusterRecord => {
  if (typeof entry !== "object" || entry === null) {
    return false
  }
  const candidate = entry as Record<string, unknown>
  return (
    candidate.isMusicMatch === true &&
    Array.isArray(candidate.files) &&
    typeof candidate.album === "string" &&
    typeof candidate.albumArtist === "string"
  )
}

export const findMusicMatchClusters = (
  results: ReadonlyArray<unknown> | null | undefined,
): MusicMatchClusterRecord[] =>
  results ? results.filter(isMusicMatchCluster) : []

// The modal takes one flat row set. Clusters are a grouping the server
// needed to search MusicBrainz once per album; the review table shows every
// row at once, with the album visible in each row's own tags.
export const flattenMusicMatchFiles = (
  clusters: MusicMatchClusterRecord[],
): TagMatchFile[] =>
  clusters.flatMap((cluster) => cluster.files)

const getTopConfidence = (file: TagMatchFile) =>
  file.rankedCandidates.reduce(
    (best: number, scored: ScoredReleaseCandidate) =>
      Math.max(best, scored.confidence),
    0,
  )

export type MusicMatchCounts = {
  fileCount: number
  matchedFileCount: number
  unmatchedFileCount: number
}

// "Matched" means the file has at least one candidate release, not that the
// match is good enough to accept unattended. The modal applies Picard's own
// thresholds per row; this count is only the headline.
export const countMusicMatchFiles = (
  files: TagMatchFile[],
): MusicMatchCounts => ({
  fileCount: files.length,
  matchedFileCount: files.filter(
    (file) => getTopConfidence(file) > 0,
  ).length,
  unmatchedFileCount: files.filter(
    (file) => getTopConfidence(file) === 0,
  ).length,
})

// A file whose tags the user already applied through the modal is not
// re-offered. Mirrors `mergeAppliedRenamesIntoNsfResults` — the step card
// must not invite the same work twice after an Apply.
export const dropAppliedMusicMatchFiles = ({
  appliedFilePaths,
  files,
}: {
  appliedFilePaths: string[]
  files: TagMatchFile[]
}): TagMatchFile[] =>
  appliedFilePaths.length === 0
    ? files
    : ((appliedPaths: Set<string>) =>
        files.filter(
          (file) => !appliedPaths.has(file.filePath),
        ))(new Set(appliedFilePaths))
