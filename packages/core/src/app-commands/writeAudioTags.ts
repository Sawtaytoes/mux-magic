import { basename } from "node:path"

import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  filter,
  from,
  map,
  of,
  toArray,
} from "rxjs"

import type { AudioTags } from "../music/tags/audioTagFields.js"
import { diffAudioTags } from "../music/tags/diffAudioTags.js"
import { readAudioTags } from "../music/tags/readAudioTags.js"
import { writeAudioTags as writeTagsToFile } from "../music/tags/writeAudioTags.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { isAudioFilePath } from "./scanAudioFiles.js"

// Phase 4 of the Picard replacement, and the FIRST command that changes a
// file. Two callers, and they are not the same thing:
//
//  1. This command — MP3Tag's bulk field edit. One tag set applied to every
//     audio file under a folder, with no MusicBrainz match behind it. This
//     is `docs/picard-parity.md` §7 "MP3Tag behaviour the tagger must also
//     cover", item 1: set album artist, year or genre on 40 files at once.
//
//  2. `POST /music/tags` — the reviewed, per-file write the tag table's
//     Apply button makes, one row at a time, each with its own tag set.
//     That route is in `packages/api/src/api/routes/musicRoutes.ts`.
//
// A command that silently applied per-file MusicBrainz proposals with no
// review would be the blind CLI run the owner rejected, so it is
// deliberately not built.
//
// `isDryRun` reports the diff and writes nothing. Point it at a folder
// first; the run is cheap and the report is the same shape.

export type WriteAudioTagsWrittenRecord = {
  changedFields: string[]
  filePath: string
  filename: string
  isDryRun: boolean
  kind: "written"
}

export type WriteAudioTagsUnchangedRecord = {
  filePath: string
  filename: string
  kind: "unchanged"
}

export type WriteAudioTagsFailedRecord = {
  filePath: string
  filename: string
  kind: "failed"
  reason: string
}

export type WriteAudioTagsRecord =
  | WriteAudioTagsWrittenRecord
  | WriteAudioTagsUnchangedRecord
  | WriteAudioTagsFailedRecord

export type WriteAudioTagsProps = {
  isDryRun?: boolean
  isRecursive?: boolean
  isTimestampPreserved?: boolean
  recursiveDepth?: number
  sourcePath: string
  tags: AudioTags
}

// Only fields the caller actually set are compared. An absent key means
// "leave whatever is there", not "clear it" — clearing a tag is asking for
// an empty string, which `diffAudioTags` reports as `removed`.
export const getChangedTagFields = ({
  currentTags,
  tags,
}: {
  currentTags: AudioTags
  tags: AudioTags
}) =>
  diffAudioTags({ currentTags, proposedTags: tags })
    .filter(
      (difference) =>
        Object.hasOwn(tags, difference.field) &&
        difference.changeType !== "unchanged",
    )
    .map((difference) => difference.field)

// A file already carrying these values is not rewritten. Re-running the same
// command over an already-tagged folder must be a no-op; §10 of the parity
// doc makes that the acceptance test.
const commitOneFile = ({
  changedFields,
  filePath,
  filename,
  isDryRun,
  isTimestampPreserved,
  tags,
}: {
  changedFields: string[]
  filePath: string
  filename: string
  isDryRun: boolean
  isTimestampPreserved: boolean
  tags: AudioTags
}) =>
  changedFields.length === 0
    ? of<WriteAudioTagsRecord>({
        filePath,
        filename,
        kind: "unchanged",
      })
    : isDryRun
      ? of<WriteAudioTagsRecord>({
          changedFields,
          filePath,
          filename,
          isDryRun: true,
          kind: "written",
        })
      : from(
          writeTagsToFile({
            filePath,
            isTimestampPreserved,
            tags,
          }),
        ).pipe(
          map(
            (): WriteAudioTagsRecord => ({
              changedFields,
              filePath,
              filename,
              isDryRun: false,
              kind: "written",
            }),
          ),
        )

const writeOneFile = ({
  filePath,
  filename,
  isDryRun,
  isTimestampPreserved,
  tags,
}: {
  filePath: string
  filename: string
  isDryRun: boolean
  isTimestampPreserved: boolean
  tags: AudioTags
}) =>
  from(readAudioTags(filePath)).pipe(
    concatMap(({ tags: currentTags }) =>
      commitOneFile({
        changedFields: getChangedTagFields({
          currentTags,
          tags,
        }),
        filePath,
        filename,
        isDryRun,
        isTimestampPreserved,
        tags,
      }),
    ),
    // One unwritable file does not fail the batch. The row carries the
    // reason so the results panel can show which file and why.
    catchError((error: unknown) =>
      of<WriteAudioTagsRecord>({
        filePath,
        filename,
        kind: "failed",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    ),
  )

const logWriteSummary = ({
  isDryRun,
  records,
}: {
  isDryRun: boolean
  records: WriteAudioTagsRecord[]
}) =>
  logInfo(
    "writeAudioTags",
    `${
      records.filter((record) => record.kind === "written")
        .length
    } of ${records.length} files ${
      isDryRun ? "would change" : "changed"
    }.`,
  )

export const writeAudioTags = ({
  isDryRun = false,
  isRecursive = false,
  isTimestampPreserved = true,
  recursiveDepth = 1,
  sourcePath,
  tags,
}: WriteAudioTagsProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) =>
      isAudioFilePath(fileInfo.fullPath),
    ),
    withFileProgress((fileInfo) =>
      writeOneFile({
        filePath: fileInfo.fullPath,
        filename: basename(fileInfo.fullPath),
        isDryRun,
        isTimestampPreserved,
        tags,
      }),
    ),
    toArray(),
    map((records) => {
      logWriteSummary({ isDryRun, records })
      return records
    }),
    logAndRethrowPipelineError(writeAudioTags),
  )
