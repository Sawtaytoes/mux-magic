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
  isOverwritingExtractedAudio?: boolean
  outputFolderName?: string
}

export type GetAudioOffsetsProps =
  GetAudioOffsetsRequiredProps &
    GetAudioOffsetsOptionalProps

export const getAudioOffsetsDefaultProps = {
  isOverwritingExtractedAudio: false,
  outputFolderName:
    getAudioOffsetDefaultProps.outputFolderName,
} satisfies GetAudioOffsetsOptionalProps

export const getAudioOffsets = ({
  destinationFilesPath,
  isOverwritingExtractedAudio = getAudioOffsetsDefaultProps.isOverwritingExtractedAudio,
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
              isOverwritingExtractedAudio,
              outputFolderName,
              sourceFilePath,
            }).pipe(
              map((offsetInMilliseconds) => ({
                destinationFilePath,
                offsetInMilliseconds,
                sourceFilePath,
              })),
            ),
          // getAudioOffset wraps its two ffmpeg extractions + the
          // offset-finder spawn in `runTask` individually, so the outer
          // per-file iteration here must NOT hold a scheduler slot —
          // otherwise the inner runTask calls could starve waiting for
          // slots already held by their own outer ancestors.
          { isOuterScheduled: false },
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
