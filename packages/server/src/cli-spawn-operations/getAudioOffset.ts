import { dirname } from "node:path"
import { concatMap, map, of } from "rxjs"
import { getOutputPath } from "../tools/getOutputPath.js"
import { makeDirectory } from "../tools/makeDirectory.js"
import { AUDIO_OFFSETS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runAudioOffsetFinder } from "./runAudioOffsetFinder.js"
import { runFfmpeg } from "./runFfmpeg.js"

export const audioOffsetsFolderName =
  AUDIO_OFFSETS_FOLDER_NAME

type GetAudioOffsetRequiredProps = {
  destinationFilePath: string
  sourceFilePath: string
}

type GetAudioOffsetOptionalProps = {
  outputFolderName?: string
}

export type GetAudioOffsetProps =
  GetAudioOffsetRequiredProps & GetAudioOffsetOptionalProps

export const getAudioOffsetDefaultProps = {
  outputFolderName: AUDIO_OFFSETS_FOLDER_NAME,
} satisfies GetAudioOffsetOptionalProps

export const getAudioOffset = ({
  destinationFilePath,
  outputFolderName = getAudioOffsetDefaultProps.outputFolderName,
  sourceFilePath,
}: GetAudioOffsetProps): ReturnType<
  typeof runAudioOffsetFinder
> =>
  of({
    destinationFileOutputPath: getOutputPath({
      fileExtension: ".destination.wav",
      filePath: destinationFilePath,
      folderName: outputFolderName,
    }),
    sourceFileOutputPath: getOutputPath({
      fileExtension: ".source.wav",
      filePath: destinationFilePath,
      folderName: outputFolderName,
    }),
  }).pipe(
    concatMap(
      ({
        destinationFileOutputPath,
        sourceFileOutputPath,
      }) =>
        makeDirectory(
          dirname(destinationFileOutputPath),
        ).pipe(
          map(() => ({
            destinationFileOutputPath,
            sourceFileOutputPath,
          })),
        ),
    ),
    concatMap(
      ({
        destinationFileOutputPath,
        sourceFileOutputPath,
      }) =>
        runFfmpeg({
          args: ["-c:a:0", "pcm_s16le"],
          inputFilePaths: [sourceFilePath],
          outputFilePath: sourceFileOutputPath,
        }).pipe(
          concatMap(() =>
            runFfmpeg({
              args: ["-c:a:0", "pcm_s16le"],
              inputFilePaths: [destinationFilePath],
              outputFilePath: destinationFileOutputPath,
            }),
          ),
          map(() => ({
            destinationFileOutputPath,
            sourceFileOutputPath,
          })),
        ),
    ),
    concatMap(
      ({
        destinationFileOutputPath,
        sourceFileOutputPath,
      }) =>
        runAudioOffsetFinder({
          destinationFilePath: destinationFileOutputPath,
          sourceFilePath: sourceFileOutputPath,
        }),
    ),
  )
