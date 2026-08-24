import { dirname } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  from,
  lastValueFrom,
  map,
  of,
  toArray,
} from "rxjs"

import {
  DEFAULT_NAMING_OPTIONS,
  DEFAULT_NAMING_SCRIPT,
} from "../music/naming/defaultNamingScript.js"
import { formatTrackPath } from "../music/naming/formatTrackPath.js"
import { moveSingleFile } from "../tools/moveSingleFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// Phase 7: name and move. The file's OWN tags decide where it goes, so this
// runs after the tags are correct, never before.
//
// The naming rules are conditional and the plan warns that a flat template
// cannot express them — the disc prefix appears only on a multi-disc
// release and gains a digit past nine discs, the album folder disappears
// when there is no album artist, and the track artist appears only on a
// multi-artist release. All of that lives in the Picard script engine
// (`music/naming/`), which this command only calls.
//
// The acceptance test is in `docs/picard-parity.md` §10: re-running over an
// album already filed correctly must produce ZERO moves. A file already at
// its computed path is reported `unchanged` and never touched.

export type RenameAndMoveAudioFilesMovedRecord = {
  destination: string
  isDryRun: boolean
  kind: "moved"
  source: string
}

export type RenameAndMoveAudioFilesUnchangedRecord = {
  kind: "unchanged"
  source: string
}

export type RenameAndMoveAudioFilesSkippedRecord = {
  kind: "skipped"
  reason: string
  source: string
}

export type RenameAndMoveAudioFilesRecord =
  | RenameAndMoveAudioFilesMovedRecord
  | RenameAndMoveAudioFilesUnchangedRecord
  | RenameAndMoveAudioFilesSkippedRecord

export type RenameAndMoveAudioFilesProps = {
  isDryRun?: boolean
  isOverwriteAllowed?: boolean
  isRecursive?: boolean
  libraryRoot: string
  namingScript?: string
  recursiveDepth?: number
  sourcePath: string
}

// A file with no album artist and no title has nothing to name it by, and
// the script would produce a path built out of empty segments. Refusing is
// the only safe answer — the alternative is a library full of `Unknown/`.
export const hasEnoughMetadataToName = (
  record: ScanAudioFilesScannedRecord,
) =>
  (record.tags.title ?? "").trim().length > 0 &&
  (
    record.tags.albumArtist ??
    record.tags.artist ??
    ""
  ).trim().length > 0

const buildDestination = ({
  libraryRoot,
  namingScript,
  record,
}: {
  libraryRoot: string
  namingScript: string
  record: ScanAudioFilesScannedRecord
}) =>
  formatTrackPath({
    extension: record.extension,
    libraryRoot,
    metadata: {
      album: record.tags.album,
      albumArtist: record.tags.albumArtist,
      artist: record.tags.artist,
      date: record.tags.date,
      discNumber: record.tags.discNumber,
      isMultiArtist:
        (record.tags.albumArtist ?? "").trim() !==
        (record.tags.artist ?? "").trim(),
      title: record.tags.title,
      totalDiscs: record.tags.totalDiscs,
      totalTracks: record.tags.totalTracks,
      trackNumber: record.tags.trackNumber,
    },
    namingOptions: DEFAULT_NAMING_OPTIONS,
    script: namingScript,
  })

const moveOneFile = ({
  destination,
  isOverwriteAllowed,
  source,
}: {
  destination: string
  isOverwriteAllowed: boolean
  source: string
}) =>
  from(
    lastValueFrom(makeDirectory(dirname(destination))),
  ).pipe(
    concatMap(() =>
      from(
        moveSingleFile({
          copyOptions: {},
          destinationPath: destination,
          isOverwriteAllowed,
          sourcePath: source,
        }),
      ),
    ),
    map(
      (): RenameAndMoveAudioFilesRecord => ({
        destination,
        isDryRun: false,
        kind: "moved",
        source,
      }),
    ),
  )

const planOneFile = ({
  isDryRun,
  isOverwriteAllowed,
  libraryRoot,
  namingScript,
  record,
}: {
  isDryRun: boolean
  isOverwriteAllowed: boolean
  libraryRoot: string
  namingScript: string
  record: ScanAudioFilesScannedRecord
}) =>
  !hasEnoughMetadataToName(record)
    ? of<RenameAndMoveAudioFilesRecord>({
        kind: "skipped",
        reason:
          "No title, and no album artist or artist. Tag the file before filing it.",
        source: record.filePath,
      })
    : ((destination: string) =>
        destination === record.filePath
          ? of<RenameAndMoveAudioFilesRecord>({
              kind: "unchanged",
              source: record.filePath,
            })
          : isDryRun
            ? of<RenameAndMoveAudioFilesRecord>({
                destination,
                isDryRun: true,
                kind: "moved",
                source: record.filePath,
              })
            : moveOneFile({
                destination,
                isOverwriteAllowed,
                source: record.filePath,
              }).pipe(
                catchError((error: unknown) =>
                  of<RenameAndMoveAudioFilesRecord>({
                    kind: "skipped",
                    reason:
                      error instanceof Error
                        ? error.message
                        : String(error),
                    source: record.filePath,
                  }),
                ),
              ))(
        buildDestination({
          libraryRoot,
          namingScript,
          record,
        }),
      )

const logMoveSummary = ({
  isDryRun,
  records,
}: {
  isDryRun: boolean
  records: RenameAndMoveAudioFilesRecord[]
}) =>
  logInfo(
    "renameAndMoveAudioFiles",
    `${
      records.filter((record) => record.kind === "moved")
        .length
    } ${isDryRun ? "would move" : "moved"}, ${
      records.filter(
        (record) => record.kind === "unchanged",
      ).length
    } already filed, ${
      records.filter((record) => record.kind === "skipped")
        .length
    } skipped.`,
  )

export const renameAndMoveAudioFiles = ({
  isDryRun = false,
  isOverwriteAllowed = false,
  isRecursive = false,
  libraryRoot,
  namingScript = DEFAULT_NAMING_SCRIPT,
  recursiveDepth = 1,
  sourcePath,
}: RenameAndMoveAudioFilesProps) =>
  scanAudioFiles({
    isRecursive,
    recursiveDepth,
    sourcePath,
  }).pipe(
    map((records) =>
      records.filter(
        (record): record is ScanAudioFilesScannedRecord =>
          record.kind === "scanned",
      ),
    ),
    concatMap((scannedRecords) =>
      from(scannedRecords).pipe(
        // One file at a time, deliberately. The destination check and the
        // rename are two separate syscalls, so two files that name to the
        // SAME destination both pass the check in parallel and the second
        // silently replaces the first. Two rips of the same track in one
        // folder is the ordinary case, not a strange one. The moves are
        // metadata-only renames and the slow part (the scan) is already
        // done, so the sequential run costs almost nothing.
        withFileProgress(
          (record) =>
            planOneFile({
              isDryRun,
              isOverwriteAllowed,
              libraryRoot,
              namingScript,
              record,
            }),
          { concurrency: 1 },
        ),
        toArray(),
      ),
    ),
    map((records) => {
      logMoveSummary({ isDryRun, records })
      return records
    }),
    logAndRethrowPipelineError(renameAndMoveAudioFiles),
  )
