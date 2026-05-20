import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  map,
  mergeMap,
  type Observable,
  of,
  toArray,
} from "rxjs"
import {
  convertLosslessFileToFlac,
  convertLosslessFileToFlacDefaultProps,
} from "../cli-spawn-operations/convertLosslessFileToFlac.js"
import { filterIsLosslessAudioFile } from "../tools/filterIsLosslessAudioFile.js"
import { getIsLosslessFlacCompatible } from "../tools/getIsLosslessFlacCompatible.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ConvertLosslessToFlacRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ConvertLosslessToFlacOptionalProps = {
  isAuditOnly?: boolean
  isSourceDeleted?: boolean
}

export type ConvertLosslessToFlacProps =
  ConvertLosslessToFlacRequiredProps &
    ConvertLosslessToFlacOptionalProps

export type ConvertLosslessToFlacSkipReason =
  | "audit-only"
  | "dsd"
  | "float-pcm"

export type ConvertLosslessToFlacConvertedRecord = {
  destination: string
  isSourceDeleted: boolean
  kind: "converted"
  source: string
}

export type ConvertLosslessToFlacSkippedRecord = {
  kind: "skipped"
  reason: ConvertLosslessToFlacSkipReason
  source: string
}

export type ConvertLosslessToFlacRecord =
  | ConvertLosslessToFlacConvertedRecord
  | ConvertLosslessToFlacSkippedRecord

export const convertLosslessToFlacDefaultProps = {
  isAuditOnly: false,
  isSourceDeleted:
    convertLosslessFileToFlacDefaultProps.isSourceDeleted,
} satisfies ConvertLosslessToFlacOptionalProps

export const convertLosslessToFlac = ({
  isAuditOnly = convertLosslessToFlacDefaultProps.isAuditOnly,
  isRecursive,
  isSourceDeleted = convertLosslessToFlacDefaultProps.isSourceDeleted,
  sourcePath,
}: ConvertLosslessToFlacProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsLosslessAudioFile(),
    // The probe lives INSIDE `withFileProgress` so skipped files still
    // count toward the per-job file total — otherwise a library scan
    // would under-report progress on float / DSD inputs.
    withFileProgress((fileInfo) =>
      getIsLosslessFlacCompatible(fileInfo).pipe(
        mergeMap(
          (
            probeResult,
          ): Observable<ConvertLosslessToFlacRecord> => {
            if (probeResult.kind === "skip") {
              logInfo(
                "SKIPPED FLAC SOURCE",
                `${probeResult.reason}: ${fileInfo.fullPath}`,
              )
              return of<ConvertLosslessToFlacSkippedRecord>(
                {
                  kind: "skipped",
                  reason: probeResult.reason,
                  source: fileInfo.fullPath,
                },
              )
            }
            if (isAuditOnly) {
              logInfo(
                "SKIPPED FLAC SOURCE",
                `audit-only: ${fileInfo.fullPath}`,
              )
              return of<ConvertLosslessToFlacSkippedRecord>(
                {
                  kind: "skipped",
                  reason: "audit-only",
                  source: fileInfo.fullPath,
                },
              )
            }
            return convertLosslessFileToFlac({
              filePath: fileInfo.fullPath,
              isSourceDeleted,
            }).pipe(
              map(
                (
                  destination,
                ): ConvertLosslessToFlacConvertedRecord => {
                  logInfo("CREATED FLAC FILE", destination)
                  return {
                    destination,
                    isSourceDeleted,
                    kind: "converted",
                    source: fileInfo.fullPath,
                  }
                },
              ),
            )
          },
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(convertLosslessToFlac),
  )
