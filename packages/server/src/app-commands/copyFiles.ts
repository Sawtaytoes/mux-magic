import { cp, readdir, stat } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  aclSafeCopyFile,
  applyRenameRegex,
  type CopyOptions,
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
  type RenameRegex,
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
  merge,
  Observable,
  tap,
  toArray,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"

export type CopyRecord = {
  source: string
  destination: string
}

// Re-exported so existing imports `from "./copyFiles.js"` (notably the
// sibling `moveFiles.ts` and any downstream callers) keep compiling
// after the type moved to `@mux-magic/tools`.
export type { RenameRegex } from "@mux-magic/tools"

// Wraps the inner copy pipeline in an Observable whose teardown aborts
// an internal AbortController. The signal threads into every per-file
// `aclSafeCopyFile` call so an unsubscribe (sequence cancel, parallel
// sibling fail-fast) destroys the in-flight stream pipeline mid-byte
// instead of letting the remaining gigabytes finish copying. Same shape
// the spawn wrappers (`runFfmpeg`, `runMkvMerge`, …) use to kill child
// processes on unsubscribe.
export const copyFiles = ({
  destinationPath,
  fileFilterRegex,
  folderFilterRegex,
  isIncludingFolders = false,
  renameRegex,
  sourcePath,
}: {
  destinationPath: string
  fileFilterRegex?: string
  folderFilterRegex?: string
  isIncludingFolders?: boolean
  renameRegex?: RenameRegex
  sourcePath: string
}): Observable<CopyRecord> =>
  new Observable<CopyRecord>((subscriber) => {
    const abortController = new AbortController()

    // File copy pipeline: uses getFiles() for the flat file listing so
    // existing behaviour is preserved. Adds optional regex filter and
    // rename on top.
    // When includeFolders is true, files are only copied if fileFilterRegex
    // is explicitly set — otherwise the command operates in folder-only mode.
    const filesCopy$ =
      isIncludingFolders && fileFilterRegex == null
        ? EMPTY
        : getFiles({ sourcePath }).pipe(
            toArray(),
            concatMap((files) =>
              defer(async () => {
                const filteredFiles =
                  fileFilterRegex == null
                    ? files
                    : files.filter((file) =>
                        new RegExp(fileFilterRegex).test(
                          file.filename.concat(
                            extname(file.fullPath),
                          ),
                        ),
                      )
                const jobId = getActiveJobId()
                const sizes =
                  jobId !== undefined
                    ? await Promise.all(
                        filteredFiles.map((file) =>
                          stat(file.fullPath).then(
                            (stats) => stats.size,
                          ),
                        ),
                      )
                    : []
                const totalBytes = sizes.reduce(
                  (sum, size) => sum + size,
                  0,
                )
                const emitter =
                  jobId !== undefined
                    ? createProgressEmitter(jobId, {
                        totalFiles: filteredFiles.length,
                        totalBytes,
                      })
                    : null
                return { filteredFiles, sizes, emitter }
              }).pipe(
                concatMap(
                  ({ filteredFiles, sizes, emitter }) =>
                    from(
                      filteredFiles.map((file, index) => ({
                        file,
                        size: sizes[index] ?? 0,
                      })),
                    ).pipe(
                      runTasks(({ file, size }) => {
                        const destinationFilename =
                          applyRenameRegex(
                            file.filename.concat(
                              extname(file.fullPath),
                            ),
                            renameRegex,
                          )
                        const targetPath = join(
                          destinationPath,
                          destinationFilename,
                        )
                        const tracker =
                          emitter !== null
                            ? emitter.startFile(
                                file.fullPath,
                                size,
                              )
                            : null
                        // aclSafeCopyFile.onProgress fires per chunk with
                        // ABSOLUTE bytesWritten. The tracker's reportBytes
                        // wants per-chunk delta, so we track the high-water mark.
                        let lastBytesWritten = 0
                        const copyOptions: CopyOptions = {
                          signal: abortController.signal,
                          ...(tracker !== null
                            ? {
                                onProgress: (event) => {
                                  const delta =
                                    event.bytesWritten -
                                    lastBytesWritten
                                  lastBytesWritten =
                                    event.bytesWritten
                                  tracker.reportBytes(delta)
                                },
                              }
                            : {}),
                        }
                        return makeDirectory(
                          destinationPath,
                        ).pipe(
                          concatMap(() =>
                            aclSafeCopyFile(
                              file.fullPath,
                              targetPath,
                              copyOptions,
                            ),
                          ),
                          tap(() => {
                            logInfo(
                              "COPIED",
                              file.fullPath,
                              targetPath,
                            )
                          }),
                          map(() => ({
                            source: file.fullPath,
                            destination: targetPath,
                          })),
                          finalize(() =>
                            tracker?.finish(size),
                          ),
                        )
                      }),
                      finalize(() => emitter?.finalize()),
                    ),
                ),
              ),
            ),
          )

    // Folder copy pipeline: only runs when includeFolders is true.
    // Reads the top-level entries of sourcePath, filters directories by
    // folderFilterRegex, and copies each matching folder recursively via
    // fs.cp. Rename is applied to the folder name only (not its contents).
    const foldersCopy$ = isIncludingFolders
      ? defer(() =>
          readdir(sourcePath, { withFileTypes: true }),
        ).pipe(
          concatMap((entries) => from(entries)),
          filter((entry) => entry.isDirectory()),
          filter(
            (entry) =>
              folderFilterRegex == null ||
              new RegExp(folderFilterRegex).test(
                entry.name,
              ),
          ),
          concatMap((entry) => {
            const sourceFolderPath = join(
              sourcePath,
              entry.name,
            )
            const destFolderName = applyRenameRegex(
              entry.name,
              renameRegex,
            )
            const destFolderPath = join(
              destinationPath,
              destFolderName,
            )
            return makeDirectory(destinationPath)
              .pipe(
                concatMap(() =>
                  defer(() =>
                    cp(sourceFolderPath, destFolderPath, {
                      recursive: true,
                    }),
                  ),
                ),
              )
              .pipe(
                tap(() => {
                  logInfo(
                    "COPIED",
                    sourceFolderPath,
                    destFolderPath,
                  )
                }),
                map(() => ({
                  source: sourceFolderPath,
                  destination: destFolderPath,
                })),
              )
          }),
        )
      : EMPTY

    const innerSubscription = merge(
      filesCopy$,
      foldersCopy$,
    )
      .pipe(logAndRethrowPipelineError(copyFiles))
      .subscribe(subscriber)

    return () => {
      // Order: abort first so an in-flight pipeline rejects via
      // AbortError rather than a downstream EBADF when streams are torn
      // down out from under it; then unsubscribe to stop further
      // emissions.
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
