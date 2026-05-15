import {
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, filter, map, tap, toArray } from "rxjs"
import {
  getAudioOffset,
  getAudioOffsetDefaultProps,
} from "../cli-spawn-operations/getAudioOffset.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type GetAudioOffsetsRequiredProps = {
  destinationFilesPath: string
  sourcePath: string
}

type GetAudioOffsetsOptionalProps = {
  outputFolderName?: string
}

export type GetAudioOffsetsProps =
  GetAudioOffsetsRequiredProps &
    GetAudioOffsetsOptionalProps

export const getAudioOffsetsDefaultProps = {
  outputFolderName:
    getAudioOffsetDefaultProps.outputFolderName,
} satisfies GetAudioOffsetsOptionalProps

export const getAudioOffsets = ({
  destinationFilesPath,
  outputFolderName = getAudioOffsetsDefaultProps.outputFolderName,
  sourcePath,
}: GetAudioOffsetsProps) =>
  getFiles({
    sourcePath,
  }).pipe(
    toArray(),
    concatMap((sourceFileInfos) =>
      getFiles({
        sourcePath: destinationFilesPath,
      }).pipe(
        map((destinationFileInfo) => ({
          destinationFilePath: destinationFileInfo.fullPath,
          sourceFilePath:
            sourceFileInfos.find(
              (sourceFileInfo) =>
                sourceFileInfo.filename ===
                destinationFileInfo.filename,
            )?.fullPath || "",
        })),
        filter(({ sourceFilePath }) =>
          Boolean(sourceFilePath),
        ),
        withFileProgress(
          ({ destinationFilePath, sourceFilePath }) =>
            getAudioOffset({
              destinationFilePath,
              outputFolderName,
              sourceFilePath,
            }).pipe(
              map((offsetInMilliseconds) => ({
                destinationFilePath,
                offsetInMilliseconds,
                sourceFilePath,
              })),
            ),
        ),
        tap(
          ({
            destinationFilePath,
            offsetInMilliseconds,
            sourceFilePath,
          }) => {
            logInfo(
              "OFFSET IN MILLISECONDS",
              offsetInMilliseconds,
              sourceFilePath,
              destinationFilePath,
            )
          },
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(getAudioOffsets),
  )
