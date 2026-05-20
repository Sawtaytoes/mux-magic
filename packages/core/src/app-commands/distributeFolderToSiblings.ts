import { rm, stat } from "node:fs/promises"
import {
  basename,
  dirname,
  join,
  relative,
} from "node:path"
import {
  aclSafeCopyFile,
  type CopyOptions,
  type FileInfo,
  type FolderInfo,
  getFilesAtDepth,
  getFolder,
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
  runTasks,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  EMPTY,
  filter,
  finalize,
  from,
  map,
  Observable,
  tap,
  toArray,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"

type DistributeRecord = {
  source: string
  destination: string
}

type FilePlacement = {
  file: FileInfo
  size: number
  destination: string
}

// Distributes a folder into each of its siblings. For every sibling directory
// of `dirname(sourceFolderPath)`, the source folder's full recursive contents
// are copied under `<sibling>/<basename(sourceFolderPath)>/...`. The canonical
// use case is an `attachments` folder beside per-episode directories — running
// this command places a copy of `attachments` inside every episode dir.
//
// Sibling directories may live on other volumes when the parent is a junction
// or bind-mount, so the copy goes through `aclSafeCopyFile` (byte copy with
// ACL preservation) rather than `fs.rename`. Per-file copies share the global
// task scheduler with concurrent commands.
//
// Wrapped in an AbortController-aware Observable for the same reason
// `copyFiles` does: a sequence cancel or parallel-sibling fail-fast must
// interrupt the in-flight stream copy mid-byte instead of letting the
// remaining gigabytes finish.
export const distributeFolderToSiblings = ({
  isDeletingSourceFolderAfterDistributing = false,
  sourceFolderPath,
}: {
  isDeletingSourceFolderAfterDistributing?: boolean
  sourceFolderPath: string
}): Observable<DistributeRecord> => {
  const parentPath = dirname(sourceFolderPath)
  const sourceFolderName = basename(sourceFolderPath)

  return new Observable<DistributeRecord>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFolder({
      sourcePath: parentPath,
    })
      .pipe(
        // Skip the source folder itself. Compare by folder name (not full
        // path) because getFolder joins with the OS path separator — on
        // Windows that's a backslash, so a string-equality check against the
        // POSIX-style `sourceFolderPath` we accept misses.
        filter(
          (folderInfo: FolderInfo) =>
            folderInfo.folderName !== sourceFolderName,
        ),
        toArray(),
        concatMap((siblings) => {
          if (siblings.length === 0) {
            return EMPTY
          }
          return getFilesAtDepth({
            depth: Number.POSITIVE_INFINITY,
            sourcePath: sourceFolderPath,
          }).pipe(
            toArray(),
            concatMap((sourceFiles) =>
              defer(async () => {
                const placements: FilePlacement[] =
                  siblings.flatMap((sibling) =>
                    sourceFiles.map((file) => ({
                      file,
                      size: 0,
                      destination: join(
                        sibling.fullPath,
                        sourceFolderName,
                        relative(
                          sourceFolderPath,
                          file.fullPath,
                        ),
                      ),
                    })),
                  )
                const jobId = getActiveJobId()
                const sizedPlacements =
                  jobId === undefined
                    ? placements
                    : await Promise.all(
                        placements.map((placement) =>
                          stat(
                            placement.file.fullPath,
                          ).then((stats) => ({
                            ...placement,
                            size: stats.size,
                          })),
                        ),
                      )
                const totalBytes = sizedPlacements.reduce(
                  (sum, placement) => sum + placement.size,
                  0,
                )
                const emitter =
                  jobId === undefined
                    ? null
                    : createProgressEmitter(jobId, {
                        totalFiles: sizedPlacements.length,
                        totalBytes,
                      })
                return {
                  emitter,
                  placements: sizedPlacements,
                }
              }).pipe(
                concatMap(({ emitter, placements }) =>
                  from(placements).pipe(
                    runTasks(
                      ({
                        destination,
                        file,
                        size,
                      }: FilePlacement) => {
                        const tracker =
                          emitter === null
                            ? null
                            : emitter.startFile(
                                file.fullPath,
                                size,
                              )

                        // aclSafeCopyFile.onProgress reports the
                        // cumulative bytesWritten for the current
                        // file; the tracker wants the per-chunk
                        // delta, so we hold the last value in a
                        // closure-scoped object (no `let`).
                        const progressState = {
                          lastBytesWritten: 0,
                        }

                        const copyOptions: CopyOptions = {
                          signal: abortController.signal,
                          ...(tracker === null
                            ? {}
                            : {
                                onProgress: (event) => {
                                  const delta =
                                    event.bytesWritten -
                                    progressState.lastBytesWritten
                                  progressState.lastBytesWritten =
                                    event.bytesWritten
                                  tracker.reportBytes(delta)
                                },
                              }),
                        }

                        return makeDirectory(
                          dirname(destination),
                        ).pipe(
                          concatMap(() =>
                            aclSafeCopyFile(
                              file.fullPath,
                              destination,
                              copyOptions,
                            ),
                          ),
                          tap(() => {
                            logInfo(
                              "DISTRIBUTED",
                              file.fullPath,
                              destination,
                            )
                          }),
                          map(() => ({
                            source: file.fullPath,
                            destination,
                          })),
                          finalize(() =>
                            tracker?.finish(size),
                          ),
                        )
                      },
                    ),
                    finalize(() => emitter?.finalize()),
                  ),
                ),
              ),
            ),
          )
        }),
        toArray(),
        concatMap((records) => {
          if (!isDeletingSourceFolderAfterDistributing) {
            return from(records)
          }
          return defer(() =>
            rm(sourceFolderPath, { recursive: true }),
          ).pipe(
            tap(() => {
              logInfo(
                "REMOVED SOURCE FOLDER",
                sourceFolderPath,
              )
            }),
            concatMap(() => from(records)),
          )
        }),
        logAndRethrowPipelineError(
          distributeFolderToSiblings,
        ),
      )
      .subscribe(subscriber)

    return () => {
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
}
