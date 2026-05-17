import { rm, stat } from "node:fs/promises"
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
  finalize,
  from,
  map,
  Observable,
  tap,
  toArray,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"

type MoveRecord = {
  source: string
  destination: string
}

// Copies every matching file in `sourcePath` into `destinationPath`, then
// removes the source directory once all copies succeed. Emits a per-file
// `{ source, destination }` record so the builder's Results panel can show
// a readable "old → new" summary instead of a string of nulls.
//
// Wraps the inner pipeline in an AbortController-aware Observable for
// the same reason `copyFiles` does: an unsubscribe (sequence cancel,
// parallel sibling fail-fast) must interrupt the in-flight stream copy
// mid-byte instead of letting the remaining gigabytes finish.
export const moveFiles = ({
  destinationPath,
  fileFilterRegex,
  renameRegex,
  sourcePath,
}: {
  destinationPath: string
  fileFilterRegex?: string
  renameRegex?: RenameRegex
  sourcePath: string
}): Observable<MoveRecord> =>
  new Observable<MoveRecord>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFiles({ sourcePath })
      .pipe(
        // Materialize the file list so we can stat upfront for the
        // emitter's totalBytes, AND know totalFiles. Skipped if there's
        // no active job context (CLI mode) — the per-file copy still
        // runs, just without progress emission.
        toArray(),
        concatMap((allFiles) =>
          defer(async () => {
            const files =
              fileFilterRegex == null
                ? allFiles
                : allFiles.filter((file) =>
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
                    files.map((file) =>
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
                    totalFiles: files.length,
                    totalBytes,
                  })
                : null
            return { files, sizes, emitter }
          }).pipe(
            concatMap(({ files, sizes, emitter }) =>
              from(
                files.map((file, index) => ({
                  file,
                  size: sizes[index] ?? 0,
                })),
              ).pipe(
                // Per-file copies go through the global Task scheduler — see
                // copyFiles.ts for the full rationale.
                runTasks(({ file, size }) => {
                  const destinationFilename =
                    applyRenameRegex(
                      file.filename.concat(
                        extname(file.fullPath),
                      ),
                      renameRegex,
                    )
                  const destinationFilePath = join(
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
                  // ABSOLUTE bytesWritten across the lifetime of one
                  // file copy. The tracker's reportBytes wants per-chunk
                  // delta, so we track the previous high-water mark.
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
                        destinationFilePath,
                        copyOptions,
                      ),
                    ),
                    tap(() => {
                      logInfo(
                        "COPIED",
                        file.fullPath,
                        destinationFilePath,
                      )
                    }),
                    map(() => ({
                      source: file.fullPath,
                      destination: destinationFilePath,
                    })),
                    finalize(() => tracker?.finish(size)),
                  )
                }),
                finalize(() => emitter?.finalize()),
              ),
            ),
          ),
        ),
        // Buffer the per-file move records so the source-dir removal only
        // runs after every copy finished. Re-emit them downstream once rm
        // resolves so callers (and the API job runner) see the full set.
        toArray(),
        concatMap((moves) =>
          defer(() =>
            rm(sourcePath, { recursive: true }),
          ).pipe(
            tap(() => {
              logInfo("DELETED", sourcePath)
            }),
            concatMap(() => from(moves)),
          ),
        ),
        logAndRethrowPipelineError(moveFiles),
      )
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
