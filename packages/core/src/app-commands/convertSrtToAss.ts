import { extname, join, relative } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { filter, tap, toArray } from "rxjs"
import { convertSrtFileToAss } from "../cli-spawn-operations/convertSrtFileToAss.js"
import { CONVERTED_SUBTITLES_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ConvertSrtToAssRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ConvertSrtToAssOptionalProps = {
  outputFolderName?: string
  recursiveDepth?: number
}

export type ConvertSrtToAssProps =
  ConvertSrtToAssRequiredProps &
    ConvertSrtToAssOptionalProps

export const convertSrtToAssDefaultProps = {
  outputFolderName: CONVERTED_SUBTITLES_FOLDER_NAME,
} satisfies ConvertSrtToAssOptionalProps

const getAssOutputFilePath = ({
  inputFilePath,
  outputFolderName,
  sourcePath,
}: {
  inputFilePath: string
  outputFolderName: string
  sourcePath: string
}) =>
  join(
    sourcePath,
    outputFolderName,
    relative(sourcePath, inputFilePath).replace(
      /\.srt$/iu,
      ".ass",
    ),
  )

export const convertSrtToAss = ({
  isRecursive,
  outputFolderName = convertSrtToAssDefaultProps.outputFolderName,
  recursiveDepth,
  sourcePath,
}: ConvertSrtToAssProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filter(
      (fileInfo) =>
        extname(fileInfo.fullPath).toLowerCase() === ".srt",
    ),
    withFileProgress((fileInfo) =>
      convertSrtFileToAss({
        inputFilePath: fileInfo.fullPath,
        outputFilePath: getAssOutputFilePath({
          inputFilePath: fileInfo.fullPath,
          outputFolderName,
          sourcePath,
        }),
      }).pipe(
        tap((destination) => {
          logInfo("CREATED ASS SUBTITLE", destination)
        }),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(convertSrtToAss),
  )
