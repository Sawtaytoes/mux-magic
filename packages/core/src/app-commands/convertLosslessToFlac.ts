import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { filter, tap, toArray } from "rxjs"
import {
  convertLosslessFileToFlac,
  convertLosslessFileToFlacDefaultProps,
} from "../cli-spawn-operations/convertLosslessFileToFlac.js"
import { filterIsLosslessAudioFile } from "../tools/filterIsLosslessAudioFile.js"
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
  isRecursive,
  isSourceDeleted = convertLosslessToFlacDefaultProps.isSourceDeleted,
  sourcePath,
}: ConvertLosslessToFlacProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsLosslessAudioFile(),
    withFileProgress((fileInfo) =>
      convertLosslessFileToFlac({
        filePath: fileInfo.fullPath,
        isSourceDeleted,
      }).pipe(
        tap((outputFilePath) => {
          logInfo("CREATED FLAC FILE", outputFilePath)
        }),
        filter(Boolean),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(convertLosslessToFlac),
  )
