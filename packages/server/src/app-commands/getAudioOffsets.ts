import { concatMap, filter, map, tap, toArray } from "rxjs"
import {
  getAudioOffset,
  getAudioOffsetDefaultProps,
} from "../cli-spawn-operations/getAudioOffset.js"
import { getFiles } from "../tools/getFiles.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type GetAudioOffsetsRequiredProps = {
  destinationFilesPath: string
  sourceFilesPath: string
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
  sourceFilesPath,
}: GetAudioOffsetsProps) =>
  getFiles({
    sourcePath: sourceFilesPath,
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
    logAndRethrow(getAudioOffsets),
  )
