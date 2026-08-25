import { basename } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  from,
  map,
  of,
  toArray,
} from "rxjs"

import { runFpcalc } from "../cli-spawn-operations/runFpcalc.js"
import { getAudioContentHash } from "../music/duplicates/audioContentHash.js"
import {
  type DuplicateCandidate,
  type DuplicateGroup,
  groupDuplicateCandidates,
} from "../music/duplicates/groupDuplicateCandidates.js"
import {
  type RankedDuplicateCopy,
  rankDuplicateCopies,
} from "../music/duplicates/rankDuplicateCopies.js"
import type { AudioFileInfo } from "../music/tags/audioTagFields.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// Phase 8 of the Picard replacement: find the copies, rank them, and
// recommend which one to keep.
//
// ⚠️ Read-only, and that is not an implementation detail. The music
// library lives on a share with NO Recycle Bin, where a delete is
// effectively permanent inside the hour and the only safety net is the
// hourly ZFS snapshot. So this command reports; the duplicate compare
// table is where a human confirms; and even then the standing preference
// is to MOVE a losing copy to a holding folder rather than delete it.
//
// Three ways two files can be the same track, and the group carries which
// one found it — "identical audio" and "same tags" deserve very different
// amounts of trust from the person reading the table.

export type FindDuplicateAudioFilesGroupRecord = {
  copies: RankedDuplicateCopy[]
  groupKey: string
  isDuplicateGroup: true
  kind: "duplicateGroup"
  matchReason: DuplicateGroup["matchReason"]
}

export type FindDuplicateAudioFilesProps = {
  isFingerprintCompared?: boolean
  isRecursive?: boolean
  recursiveDepth?: number
  sourcePath: string
}

type ExaminedFile = {
  audioContentHash: string | null
  fingerprint: string | null
  info: AudioFileInfo
  record: ScanAudioFilesScannedRecord
}

// Hashing decodes the whole file, and fingerprinting decodes two minutes
// of it. Both are expensive enough that a failure has to be survivable —
// a file that will not decode still belongs in the tag-matched groups.
const examineOneFile = ({
  isFingerprintCompared,
  record,
}: {
  isFingerprintCompared: boolean
  record: ScanAudioFilesScannedRecord
}) =>
  from(getAudioContentHash(record.filePath)).pipe(
    catchError((error: unknown) => {
      logInfo(
        "findDuplicateAudioFiles",
        `Cannot hash "${basename(record.filePath)}": ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      )
      return of(null)
    }),
    concatMap((audioContentHash) =>
      (isFingerprintCompared
        ? runFpcalc({ filePath: record.filePath }).pipe(
            map(({ fingerprint }) => fingerprint),
            catchError(() => of(null)),
          )
        : of(null)
      ).pipe(
        map(
          (fingerprint): ExaminedFile => ({
            audioContentHash,
            fingerprint,
            info: record.info,
            record,
          }),
        ),
      ),
    ),
  )

const toCandidate = (
  examined: ExaminedFile,
): DuplicateCandidate => ({
  audioContentHash: examined.audioContentHash,
  filePath: examined.record.filePath,
  fingerprint: examined.fingerprint,
  tags: examined.record.tags,
})

const toGroupRecord = ({
  group,
  infoByPath,
}: {
  group: DuplicateGroup
  infoByPath: Map<string, AudioFileInfo>
}): FindDuplicateAudioFilesGroupRecord => ({
  copies: rankDuplicateCopies(
    group.filePaths.map((filePath) => ({
      filePath,
      info: infoByPath.get(filePath) ?? {
        fileSizeBytes: 0,
        filePath,
        hasEmbeddedCoverArt: false,
      },
    })),
  ),
  groupKey: group.groupKey,
  isDuplicateGroup: true,
  kind: "duplicateGroup",
  matchReason: group.matchReason,
})

export const findDuplicateAudioFiles = ({
  // Off by default. The audio hash already catches every same-encoding
  // copy, and fingerprinting adds a two-minute decode per file to catch
  // the FLAC-beside-MP3 case, which is worth asking for rather than
  // paying for on every run.
  isFingerprintCompared = false,
  isRecursive = true,
  recursiveDepth = 3,
  sourcePath,
}: FindDuplicateAudioFilesProps) =>
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
      from(scannedRecords).pipe(
        withFileProgress((record) =>
          examineOneFile({
            isFingerprintCompared,
            record,
          }),
        ),
        toArray(),
      ),
    ),
    map((examinedFiles) =>
      ((groups: DuplicateGroup[]) => {
        logInfo(
          "findDuplicateAudioFiles",
          `${examinedFiles.length} audio files in ${groups.length} duplicate groups.`,
        )
        return groups.map((group) =>
          toGroupRecord({
            group,
            infoByPath: new Map(
              examinedFiles.map((examined) => [
                examined.record.filePath,
                examined.info,
              ]),
            ),
          }),
        )
      })(
        groupDuplicateCandidates({
          candidates: examinedFiles.map(toCandidate),
        }),
      ),
    ),
    logAndRethrowPipelineError(findDuplicateAudioFiles),
  )
