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

// Where the single kept range lands depends on the mkvmerge build. Older
// ones always append a part suffix, so `parts:-<end>` writes
// `<stem>-001.mkv` beside the `--output` path; v101 writes the `--output`
// path verbatim when the split produced exactly one part. Accept both and
// settle on the original filename, so downstream steps keep matching on
// the episode's name rather than a part suffix.
const settleOnDestinationFileName = ({
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
      if (partFilePaths.length === 1) {
        return from(
          rename(
            partFilePaths[0],
            destinationFilePath,
          ).then(() => destinationFilePath),
        )
      }

      if (partFilePaths.length > 1) {
        throw new Error(
          `trimFileTail expected at most one output part but mkvmerge wrote ${partFilePaths.length}: ${partFilePaths.join(", ")}`,
        )
      }

      // No suffixed parts: mkvmerge wrote the output path itself, which is
      // already the destination. Confirm it exists rather than assuming,
      // so a genuinely empty output folder still fails loudly.
      return defer(() =>
        stat(destinationFilePath).then(
          () => destinationFilePath,
          () => {
            throw new Error(
              `trimFileTail found no output: mkvmerge wrote neither ${destinationFilePath} nor a numbered part beside it`,
            )
          },
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
          settleOnDestinationFileName({
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
