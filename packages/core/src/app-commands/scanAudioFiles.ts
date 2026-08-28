import { basename, extname } from "node:path"

import {
  type FileInfo,
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  filter,
  from,
  map,
  of,
  toArray,
} from "rxjs"

import {
  AUDIO_FILE_EXTENSIONS,
  type AudioFileInfo,
  type AudioTags,
} from "../music/tags/audioTagFields.js"
import { readAudioTags } from "../music/tags/readAudioTags.js"
import { withFileProgress } from "../tools/progressEmitter.js"

// Phase 1 of the Picard replacement: walk a folder and report what is
// there. Pure read — nothing on disk changes, so this is the safe command
// to point at a folder you are not sure about.
//
// Every later music step consumes this row set. `matchMusicBrainzRelease`
// clusters it, the review table renders it, and `writeAudioTags` diffs
// against the `tags` it read here.

export type ScanAudioFilesScannedRecord = {
  extension: string
  filePath: string
  filename: string
  info: AudioFileInfo
  kind: "scanned"
  tags: AudioTags
}

export type ScanAudioFilesUnreadableRecord = {
  extension: string
  filePath: string
  filename: string
  kind: "unreadable"
  reason: string
}

export type ScanAudioFilesRecord =
  | ScanAudioFilesScannedRecord
  | ScanAudioFilesUnreadableRecord

export type ScanAudioFilesProps = {
  isRecursive?: boolean
  recursiveDepth?: number
  sourcePath: string
}

const audioExtensions: readonly string[] =
  AUDIO_FILE_EXTENSIONS

export const getAudioFileExtension = (filePath: string) =>
  extname(filePath).toLowerCase()

// ⚠️ Takes a PATH, not a `FileInfo.filename`. The shared walk's
// `filename` is `basename(path, extname(path))` — the stem, with the
// extension already stripped — so filtering on it silently matches
// nothing and the command reports an empty folder.
export const isAudioFilePath = (filePath: string) =>
  audioExtensions.includes(getAudioFileExtension(filePath))

// A file that cannot be parsed becomes a row, not a failed run. A folder of
// 200 tracks with one truncated download is the normal case, and killing
// the scan over it would mean the other 199 never reach the review table.
const scanOneFile = (fileInfo: FileInfo) =>
  from(readAudioTags(fileInfo.fullPath)).pipe(
    map(
      ({ info, tags }): ScanAudioFilesRecord => ({
        extension: getAudioFileExtension(fileInfo.fullPath),
        filePath: fileInfo.fullPath,
        filename: basename(fileInfo.fullPath),
        info,
        kind: "scanned",
        tags,
      }),
    ),
    catchError((error: unknown) => {
      logInfo(
        "scanAudioFiles",
        `Cannot read "${basename(fileInfo.fullPath)}": ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      )
      return of<ScanAudioFilesRecord>({
        extension: getAudioFileExtension(fileInfo.fullPath),
        filePath: fileInfo.fullPath,
        filename: basename(fileInfo.fullPath),
        kind: "unreadable",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      })
    }),
  )

export const scanAudioFilesStream = ({
  isRecursive = false,
  recursiveDepth = 1,
  sourcePath,
}: ScanAudioFilesProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) =>
      isAudioFilePath(fileInfo.fullPath),
    ),
    withFileProgress((fileInfo) => scanOneFile(fileInfo)),
    logAndRethrowPipelineError(scanAudioFilesStream),
  )

export const scanAudioFiles = (
  props: ScanAudioFilesProps,
) =>
  scanAudioFilesStream(props).pipe(
    toArray(),
    logAndRethrowPipelineError(scanAudioFiles),
  )
