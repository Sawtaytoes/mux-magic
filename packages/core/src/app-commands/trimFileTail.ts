import { readdir, rename, stat } from "node:fs/promises"
import { dirname, join } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
} from "@mux-magic/tools"
import { concatMap, defer, from, map, tap } from "rxjs"

import {
  trimTailMkvMerge,
  trimTailMkvMergeDefaultProps,
} from "../cli-spawn-operations/trimTailMkvMerge.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import { getSplitOutputFilePaths } from "../tools/getSplitOutputFilePaths.js"

type TrimFileTailRequiredProps = {
  endTime: string
  fileName: string
  sourcePath: string
}

type TrimFileTailOptionalProps = {
  outputFolderName?: string
}

export type TrimFileTailProps = TrimFileTailRequiredProps &
  TrimFileTailOptionalProps

export const trimFileTailDefaultProps = {
  outputFolderName:
    trimTailMkvMergeDefaultProps.outputFolderName,
} satisfies TrimFileTailOptionalProps

export type TrimFileTailResult = {
  actualDurationSeconds: number
  filePath: string
  requestedEndTime: string
  sourceDurationSeconds: number
}

const NANOSECONDS_PER_SECOND = 1_000_000_000

const getDurationSeconds = (filePath: string) =>
  getMkvInfo(filePath).pipe(
    map(
      (mkvInfo) =>
        mkvInfo.container.properties.duration /
        NANOSECONDS_PER_SECOND,
    ),
  )

// A missing source and an occupied destination are both caller mistakes
// worth naming. `stat` alone reports a bare errno, and an accidental
// overwrite of an already-trimmed episode is unrecoverable, so refuse
// rather than clobber.
const assertPathsAreUsable = ({
  destinationFilePath,
  filePath,
}: {
  destinationFilePath: string
  filePath: string
}) =>
  defer(() =>
    stat(filePath).then(
      () =>
        stat(destinationFilePath).then(
          () => {
            throw new Error(
              `trimFileTail refuses to overwrite an existing output: ${destinationFilePath}`,
            )
          },
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
              return filePath
            }
            throw error
          },
        ),
      () => {
        throw new Error(
          `trimFileTail found no such file: ${filePath}`,
        )
      },
    ),
  )

// mkvmerge never writes the `--output` path when `--split` is in play; a
// single `parts:-<end>` range lands as `<stem>-001.mkv`. Move it back onto
// the original name so downstream steps keep matching on the episode's
// filename rather than a part suffix.
const renameSinglePartToFileName = ({
  destinationFilePath,
  outputFilePath,
}: {
  destinationFilePath: string
  outputFilePath: string
}) =>
  defer(() => readdir(dirname(outputFilePath))).pipe(
    map((fileNames) =>
      getSplitOutputFilePaths({
        fileNames,
        outputFilePath,
      }),
    ),
    concatMap((partFilePaths) => {
      if (partFilePaths.length !== 1) {
        throw new Error(
          `trimFileTail expected exactly one output part but mkvmerge wrote ${partFilePaths.length}: ${partFilePaths.join(", ")}`,
        )
      }

      return from(
        rename(partFilePaths[0], destinationFilePath).then(
          () => destinationFilePath,
        ),
      )
    }),
  )

export const trimFileTail = ({
  endTime,
  fileName,
  outputFolderName = trimFileTailDefaultProps.outputFolderName,
  sourcePath,
}: TrimFileTailProps) => {
  const filePath = join(sourcePath, fileName)
  const outputFolderPath = join(
    sourcePath,
    outputFolderName,
  )
  const destinationFilePath = join(
    outputFolderPath,
    fileName,
  )

  return assertPathsAreUsable({
    destinationFilePath,
    filePath,
  }).pipe(
    concatMap(() => getDurationSeconds(filePath)),
    concatMap((sourceDurationSeconds) =>
      makeDirectory(outputFolderPath).pipe(
        concatMap(() =>
          trimTailMkvMerge({
            endTime,
            filePath,
            outputFolderName,
          }),
        ),
        concatMap((outputFilePath) =>
          renameSinglePartToFileName({
            destinationFilePath,
            outputFilePath,
          }),
        ),
        concatMap((trimmedFilePath) =>
          getDurationSeconds(trimmedFilePath),
        ),
        map(
          (actualDurationSeconds): TrimFileTailResult => ({
            actualDurationSeconds,
            filePath: destinationFilePath,
            requestedEndTime: endTime,
            sourceDurationSeconds,
          }),
        ),
      ),
    ),
    tap((result) => {
      logInfo(
        "TRIMMED TAIL",
        `${result.filePath}: requested end ${result.requestedEndTime}, delivered ${result.actualDurationSeconds.toFixed(3)}s (source ${result.sourceDurationSeconds.toFixed(3)}s)`,
      )
    }),
    logAndRethrowPipelineError(trimFileTail),
  )
}
