import { basename } from "node:path"

import {
  type FileInfo,
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  filter,
  map,
  of,
  toArray,
} from "rxjs"

import { runFpcalc } from "../cli-spawn-operations/runFpcalc.js"
import {
  type AcoustIdMatch,
  lookupAcoustId,
} from "../tools/acoustIdApi.js"
import type { CachedFetch } from "../tools/musicBrainzApi.js"
import { acoustIdCachedFetch } from "../tools/musicProviderFetchers.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  getAudioFileExtension,
  isAudioFilePath,
} from "./scanAudioFiles.js"

// Phase 5 of the Picard replacement: identify a file by what it SOUNDS
// like, not by what its tags claim.
//
// This is the step that rescues the two cases `matchMusicBrainzRelease`
// cannot touch — a folder of `track01.mp3` with no tags at all, and a
// folder whose tags are confidently wrong. Both cluster into nothing
// useful, so the MusicBrainz search has no album name and no artist to
// search on. A fingerprint needs neither.
//
// Read-only, like every other match step. It attaches recording ids and
// scores; the review table is still where a human accepts them.

// AcoustID returns every recording an id has ever been linked to, and a
// well-known song accumulates dozens. Past the first few they are
// compilation re-issues of the same recording, so the extra rows cost
// table height and buy nothing.
export const DEFAULT_RECORDING_LIMIT = 5

// Below this, AcoustID is telling you the audio is similar rather than
// the same. Picard's own fingerprint match uses a comparable floor; a
// 0.3 hit is routinely a different take, a different mix, or a cover.
export const DEFAULT_MINIMUM_SCORE = 0.5

export type FingerprintAudioFilesMatchedRecord = {
  acoustId: string
  duration: number
  extension: string
  filePath: string
  filename: string
  fingerprint: string
  kind: "matched"
  recordings: AcoustIdMatch["recordings"]
  score: number
}

export type FingerprintAudioFilesUnmatchedRecord = {
  duration: number
  extension: string
  filePath: string
  filename: string
  fingerprint: string
  kind: "unmatched"
}

export type FingerprintAudioFilesFailedRecord = {
  extension: string
  filePath: string
  filename: string
  kind: "failed"
  reason: string
}

export type FingerprintAudioFilesRecord =
  | FingerprintAudioFilesFailedRecord
  | FingerprintAudioFilesMatchedRecord
  | FingerprintAudioFilesUnmatchedRecord

export type FingerprintAudioFilesProps = {
  cachedFetch?: CachedFetch
  isRecursive?: boolean
  minimumScore?: number
  recordingLimit?: number
  recursiveDepth?: number
  sourcePath: string
}

const toFailedRecord = ({
  error,
  filePath,
}: {
  error: unknown
  filePath: string
}): FingerprintAudioFilesRecord => ({
  extension: getAudioFileExtension(filePath),
  filePath,
  filename: basename(filePath),
  kind: "failed",
  reason:
    error instanceof Error ? error.message : String(error),
})

const toRecord = ({
  duration,
  filePath,
  fingerprint,
  matches,
  minimumScore,
  recordingLimit,
}: {
  duration: number
  filePath: string
  fingerprint: string
  matches: AcoustIdMatch[]
  minimumScore: number
  recordingLimit: number
}): FingerprintAudioFilesRecord =>
  ((bestMatch: AcoustIdMatch | undefined) =>
    bestMatch === undefined
      ? {
          duration,
          extension: getAudioFileExtension(filePath),
          filePath,
          filename: basename(filePath),
          fingerprint,
          kind: "unmatched",
        }
      : {
          acoustId: bestMatch.acoustId,
          duration,
          extension: getAudioFileExtension(filePath),
          filePath,
          filename: basename(filePath),
          fingerprint,
          kind: "matched",
          recordings: bestMatch.recordings.slice(
            0,
            recordingLimit,
          ),
          score: bestMatch.score,
        })(
    // Already sorted by score in `mapAcoustIdResponse`, so the first one
    // over the floor is the best one.
    matches.find((match) => match.score >= minimumScore),
  )

// One file's whole round trip: decode, fingerprint, look up. Any failure
// becomes a row rather than the end of the run — a folder of 200 tracks
// with one truncated download is the normal case, and killing the run
// over it would mean the other 199 never reach the table.
const fingerprintOneFile = ({
  cachedFetch,
  fileInfo,
  minimumScore,
  recordingLimit,
}: {
  cachedFetch: CachedFetch
  fileInfo: FileInfo
  minimumScore: number
  recordingLimit: number
}) =>
  runFpcalc({ filePath: fileInfo.fullPath }).pipe(
    concatMap(({ durationSeconds, fingerprint }) =>
      lookupAcoustId({
        cachedFetch,
        durationSeconds,
        fingerprint,
      }).pipe(
        map((matches) =>
          toRecord({
            duration: durationSeconds,
            filePath: fileInfo.fullPath,
            fingerprint,
            matches,
            minimumScore,
            recordingLimit,
          }),
        ),
      ),
    ),
    catchError((error: unknown) => {
      logInfo(
        "fingerprintAudioFiles",
        `Cannot fingerprint "${basename(fileInfo.fullPath)}": ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      )
      return of(
        toFailedRecord({
          error,
          filePath: fileInfo.fullPath,
        }),
      )
    }),
  )

export const fingerprintAudioFiles = ({
  cachedFetch = acoustIdCachedFetch,
  isRecursive = false,
  minimumScore = DEFAULT_MINIMUM_SCORE,
  recordingLimit = DEFAULT_RECORDING_LIMIT,
  recursiveDepth = 1,
  sourcePath,
}: FingerprintAudioFilesProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) =>
      isAudioFilePath(fileInfo.fullPath),
    ),
    withFileProgress((fileInfo) =>
      fingerprintOneFile({
        cachedFetch,
        fileInfo,
        minimumScore,
        recordingLimit,
      }),
    ),
    toArray(),
    logAndRethrowPipelineError(fingerprintAudioFiles),
  )
