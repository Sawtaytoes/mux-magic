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
  isSourceDeleted?: boolean
}

export type ConvertLosslessToFlacProps =
  ConvertLosslessToFlacRequiredProps &
    ConvertLosslessToFlacOptionalProps

export const convertLosslessToFlacDefaultProps = {
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
