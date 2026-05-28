import { basename, dirname } from "node:path"
import { makeDirectory } from "@mux-magic/tools"
import {
  concatMap,
  defer,
  forkJoin,
  map,
  of,
  finalize as rxFinalize,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { getOutputPath } from "../tools/getOutputPath.js"
import { AUDIO_OFFSETS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"
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
        // Both ffmpeg WAV extractions are independent — they read different
        // source files and write to different output paths — so fan them out
        // in parallel. forkJoin keeps the "fail-fast-and-stop" semantics the
        // old concatMap chain had: if either runFfmpeg completes without
        // emitting (its failure path), forkJoin completes without emitting,
        // which short-circuits the rest of the pipeline.
        forkJoin([
          runFfmpeg({
            args: ["-c:a:0", "pcm_s16le"],
            inputFilePaths: [sourceFilePath],
            outputFilePath: sourceFileOutputPath,
          }),
          runFfmpeg({
            args: ["-c:a:0", "pcm_s16le"],
            inputFilePaths: [destinationFilePath],
            outputFilePath: destinationFileOutputPath,
          }),
        ]).pipe(
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
        // Wrap the offset-finder spawn in its own per-file progress tracker
        // so the UI stops showing the WAV file at 95% (left over from the
        // ffmpeg phase) while audio-offset-finder is actually doing the work.
        // The finder has no progress signal of its own — pass null so the
        // row animates as indeterminate instead of freezing at a number.
        defer(() => {
          const jobId = getActiveJobId()
          const emitter =
            jobId !== undefined
              ? createProgressEmitter(jobId)
              : null
          const tracker =
            emitter !== null
              ? emitter.startFile(
                  `${basename(destinationFilePath)} (analyzing audio offset)`,
                )
              : null
          tracker?.setRatio(null)
          return runAudioOffsetFinder({
            destinationFilePath: destinationFileOutputPath,
            sourceFilePath: sourceFileOutputPath,
          }).pipe(rxFinalize(() => tracker?.finish()))
        }),
    ),
  )
