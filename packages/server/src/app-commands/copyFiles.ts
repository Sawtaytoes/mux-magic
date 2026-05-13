import { stat } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  aclSafeCopyFile,
  type CopyOptions,
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
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
import { runTasks } from "../tools/taskScheduler.js"

// Wraps the inner copy pipeline in an Observable whose teardown aborts
// an internal AbortController. The signal threads into every per-file
// `aclSafeCopyFile` call so an unsubscribe (sequence cancel, parallel
// sibling fail-fast) destroys the in-flight stream pipeline mid-byte
// instead of letting the remaining gigabytes finish copying. Same shape
// the spawn wrappers (`runFfmpeg`, `runMkvMerge`, …) use to kill child
// processes on unsubscribe.
export const copyFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}): Observable<string> =>
  new Observable<string>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFiles({ sourcePath })
      .pipe(
        // Materialize the file list so we know totalFiles + can stat for
        // totalBytes upfront. The cost is N stats and holding N small
        // FileInfo structs in memory; both are cheap relative to the
        // bytes we're about to move.
        toArray(),
        concatMap((files) =>
          defer(async () => {
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
                  size: sizes[index],
                })),
              ).pipe(
                // Per-file copies go through the global Task scheduler — at
                // MAX_THREADS=N, up to N copies run concurrently. Each gets
                // its own FileTracker so the UI shows one row per active
                // copy (path + percent), and the tracker.finish() in the
                // finalize ensures slot release on cancel.
                runTasks(({ file, size }) => {
                  const targetPath = join(
                    destinationPath,
                    file.filename.concat(
                      extname(file.fullPath),
                    ),
                  )

                  const tracker =
                    emitter !== null
                      ? emitter.startFile(
                          file.fullPath,
                          size,
                        )
                      : null

                  // aclSafeCopyFile.onProgress fires per chunk with
                  // ABSOLUTE bytesWritten across the lifetime of one file
                  // copy. The tracker's reportBytes wants per-chunk delta,
                  // so we track the previous high-water mark per file.
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
                    map(() => targetPath),
                    finalize(() => tracker?.finish(size)),
                  )
                }),
                finalize(() => emitter?.finalize()),
              ),
            ),
          ),
        ),
        logAndRethrowPipelineError(copyFiles),
      )
      .subscribe(subscriber)

    return () => {
      // Order: abort first so an in-flight pipeline rejects via
      // AbortError rather than a downstream EBADF when streams are torn
      // down out from under it; then unsubscribe to stop further
      // emissions. The catchError-as-EMPTY pattern at runJob means the
      // AbortError doesn't surface to the outer subscriber.
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
