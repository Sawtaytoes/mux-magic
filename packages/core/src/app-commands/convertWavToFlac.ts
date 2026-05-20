import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { filter, tap, toArray } from "rxjs"
import {
  convertWavFileToFlac,
  convertWavFileToFlacDefaultProps,
} from "../cli-spawn-operations/convertWavFileToFlac.js"
import { filterIsWavFile } from "../tools/filterIsWavFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ConvertWavToFlacRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ConvertWavToFlacOptionalProps = {
  isSourceDeleted?: boolean
}

export type ConvertWavToFlacProps =
  ConvertWavToFlacRequiredProps &
    ConvertWavToFlacOptionalProps

export const convertWavToFlacDefaultProps = {
  isSourceDeleted:
    convertWavFileToFlacDefaultProps.isSourceDeleted,
} satisfies ConvertWavToFlacOptionalProps

export const convertWavToFlac = ({
  isRecursive,
  isSourceDeleted = convertWavToFlacDefaultProps.isSourceDeleted,
  sourcePath,
}: ConvertWavToFlacProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsWavFile(),
    withFileProgress((fileInfo) =>
      convertWavFileToFlac({
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
    logAndRethrowPipelineError(convertWavToFlac),
  )
