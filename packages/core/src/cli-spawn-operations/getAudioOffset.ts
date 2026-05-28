import { existsSync } from "node:fs"
import { basename, dirname } from "node:path"
import { logInfo, makeDirectory } from "@mux-magic/tools"
import {
  concatMap,
  defer,
  forkJoin,
  map,
  type Observable,
  of,
  finalize as rxFinalize,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { getFileDuration } from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
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
  isOverwritingExtractedAudio?: boolean
  outputFolderName?: string
}

export type GetAudioOffsetProps =
  GetAudioOffsetRequiredProps & GetAudioOffsetOptionalProps

export const getAudioOffsetDefaultProps = {
  isOverwritingExtractedAudio: false,
  outputFolderName: AUDIO_OFFSETS_FOLDER_NAME,
} satisfies GetAudioOffsetOptionalProps

// Tolerance window for "this cached WAV still matches the source". The
// extracted audio's mediaInfo duration should equal the source media's
// general duration to within ffmpeg's stream-end rounding (which lands
// well under a second). 1s is comfortably above that noise floor while
// still catching a truncated WAV from an interrupted prior run.
const CACHED_WAV_DURATION_TOLERANCE_SECONDS = 1

const extractWav = ({
  inputFilePath,
  outputFilePath,
}: {
  inputFilePath: string
  outputFilePath: string
}): Observable<string> =>
  runFfmpeg({
    args: ["-c:a:0", "pcm_s16le"],
    inputFilePaths: [inputFilePath],
    outputFilePath,
  })

// Resolves to the WAV path (extracted or reused). Skips ffmpeg when an
// existing WAV at the target path already matches the input's duration
// within tolerance — a cheap mediaInfo probe is dramatically faster than
// re-decoding the entire audio track. Force-recreate via the caller's
// isOverwritingExtractedAudio flag.
const prepareExtractedWav = ({
  inputFilePath,
  isOverwritingExtractedAudio,
  outputFilePath,
}: {
  inputFilePath: string
  isOverwritingExtractedAudio: boolean
  outputFilePath: string
}): Observable<string> =>
  defer(() => {
    if (
      isOverwritingExtractedAudio ||
      !existsSync(outputFilePath)
    ) {
      return extractWav({ inputFilePath, outputFilePath })
    }
    return forkJoin({
      inputDuration: getMediaInfo(inputFilePath).pipe(
        concatMap((mediaInfo) =>
          getFileDuration({ mediaInfo }),
        ),
      ),
      wavDuration: getMediaInfo(outputFilePath).pipe(
        concatMap((mediaInfo) =>
          getFileDuration({ mediaInfo }),
        ),
      ),
    }).pipe(
      concatMap(({ inputDuration, wavDuration }) => {
        const isCachedWavValid =
          Number.isFinite(inputDuration) &&
          Number.isFinite(wavDuration) &&
          Math.abs(inputDuration - wavDuration) <
            CACHED_WAV_DURATION_TOLERANCE_SECONDS
        if (isCachedWavValid) {
          logInfo(
            "AUDIO OFFSET",
            `Reusing cached WAV (duration matches within ${CACHED_WAV_DURATION_TOLERANCE_SECONDS}s): ${outputFilePath}`,
          )
          return of(outputFilePath)
        }
        return extractWav({ inputFilePath, outputFilePath })
      }),
    )
  })

export const getAudioOffset = ({
  destinationFilePath,
  isOverwritingExtractedAudio = getAudioOffsetDefaultProps.isOverwritingExtractedAudio,
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
        // old concatMap chain had: if either prepareExtractedWav completes
        // without emitting (its failure path), forkJoin completes without
        // emitting, which short-circuits the rest of the pipeline.
        forkJoin([
          prepareExtractedWav({
            inputFilePath: sourceFilePath,
            isOverwritingExtractedAudio,
            outputFilePath: sourceFileOutputPath,
          }),
          prepareExtractedWav({
            inputFilePath: destinationFilePath,
            isOverwritingExtractedAudio,
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
