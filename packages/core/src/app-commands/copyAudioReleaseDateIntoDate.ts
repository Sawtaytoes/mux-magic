import { basename } from "node:path"

import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import { readAudioDateFields } from "../music/tags/readAudioTags.js"
import { writeAudioTags } from "../music/tags/writeAudioTags.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { isAudioFilePath } from "./scanAudioFiles.js"

export type CopyAudioReleaseDateIntoDateCopiedRecord = {
  date: string
  filePath: string
  filename: string
  isDryRun: boolean
  kind: "copied"
  releaseDate: string
}

export type CopyAudioReleaseDateIntoDateSkippedRecord = {
  date: string
  filePath: string
  filename: string
  kind: "skipped"
  reason: "Date is already set."
  releaseDate: string
}

export type CopyAudioReleaseDateIntoDateFailedRecord = {
  filePath: string
  filename: string
  kind: "failed"
  reason: string
}

export type CopyAudioReleaseDateIntoDateRecord =
  | CopyAudioReleaseDateIntoDateCopiedRecord
  | CopyAudioReleaseDateIntoDateSkippedRecord
  | CopyAudioReleaseDateIntoDateFailedRecord

export type CopyAudioReleaseDateIntoDateProps = {
  isDryRun?: boolean
  isRecursive?: boolean
  isTimestampPreserved?: boolean
  recursiveDepth?: number
  sourcePath: string
}

const copiedRecord = ({
  filePath,
  isDryRun,
  releaseDate,
}: {
  filePath: string
  isDryRun: boolean
  releaseDate: string
}) => ({
  date: releaseDate,
  filePath,
  filename: basename(filePath),
  isDryRun,
  kind: "copied" as const,
  releaseDate,
})

const copyOneDate = ({
  filePath,
  isDryRun,
  isTimestampPreserved,
  releaseDate,
}: {
  filePath: string
  isDryRun: boolean
  isTimestampPreserved: boolean
  releaseDate: string
}) =>
  isDryRun
    ? of(copiedRecord({ filePath, isDryRun, releaseDate }))
    : from(
        writeAudioTags({
          filePath,
          isTimestampPreserved,
          tags: { date: releaseDate },
        }),
      ).pipe(
        map(() =>
          copiedRecord({ filePath, isDryRun, releaseDate }),
        ),
      )

const inspectOneFile = ({
  filePath,
  isDryRun,
  isTimestampPreserved,
}: {
  filePath: string
  isDryRun: boolean
  isTimestampPreserved: boolean
}) =>
  from(readAudioDateFields(filePath)).pipe(
    concatMap(({ date, releaseDate }) =>
      releaseDate === undefined
        ? EMPTY
        : date === undefined
          ? copyOneDate({
              filePath,
              isDryRun,
              isTimestampPreserved,
              releaseDate,
            })
          : of<CopyAudioReleaseDateIntoDateRecord>({
              date,
              filePath,
              filename: basename(filePath),
              kind: "skipped",
              reason: "Date is already set.",
              releaseDate,
            }),
    ),
    catchError((error: unknown) =>
      of<CopyAudioReleaseDateIntoDateRecord>({
        filePath,
        filename: basename(filePath),
        kind: "failed",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    ),
  )

const logCopySummary = ({
  isDryRun,
  records,
}: {
  isDryRun: boolean
  records: CopyAudioReleaseDateIntoDateRecord[]
}) =>
  logInfo(
    "copyAudioReleaseDateIntoDate",
    `${
      records.filter((record) => record.kind === "copied")
        .length
    } files ${isDryRun ? "would change" : "changed"}; ${
      records.filter((record) => record.kind === "skipped")
        .length
    } already had Date; ${
      records.filter((record) => record.kind === "failed")
        .length
    } failed.`,
  )

export const copyAudioReleaseDateIntoDate = ({
  isDryRun = true,
  isRecursive = false,
  isTimestampPreserved = true,
  recursiveDepth = 1,
  sourcePath,
}: CopyAudioReleaseDateIntoDateProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) =>
      isAudioFilePath(fileInfo.fullPath),
    ),
    withFileProgress(
      (fileInfo) =>
        inspectOneFile({
          filePath: fileInfo.fullPath,
          isDryRun,
          isTimestampPreserved,
        }),
      { concurrency: 16, isStreaming: true },
    ),
    toArray(),
    tap((records) => {
      logCopySummary({ isDryRun, records })
    }),
    logAndRethrowPipelineError(
      copyAudioReleaseDateIntoDate,
    ),
  )
