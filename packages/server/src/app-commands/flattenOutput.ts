import { rm, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  aclSafeCopyFile,
  type CopyOptions,
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  runTasks,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  finalize,
  from,
  map,
  Observable,
  of,
  tap,
  toArray,
} from "rxjs"
import { getActiveJobId } from "../api/logCapture.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"

// Copies every file in `sourcePath` up one level into its parent directory,
// overwriting any same-named originals. By default the source folder is
// preserved so the user can inspect intermediate state mid-sequence; pass
// `deleteSourceFolder: true` to remove it once you trust the pipeline.
//
// Use case: chained operations like addSubtitles output to <work>/SUBTITLED.
// Without this command, chaining another step that also has an outputFolderName
// produces <work>/SUBTITLED/REORDERED, and so on — folder nesting accumulates.
// Running flattenOutput between steps flattens the structure: <work> always
// holds the latest cumulative result; leftover output dirs can be cleaned up
// in one shot at the end via the deleteFolder command.
//
// Wraps the inner pipeline in an AbortController-aware Observable for the
// same reason `copyFiles` does: an unsubscribe (sequence cancel, parallel
// sibling fail-fast) must interrupt the in-flight stream copy mid-byte
// instead of letting the remaining files finish.
export const flattenOutput = ({
  isDeletingSourceFolder = false,
  sourcePath,
}: {
  isDeletingSourceFolder?: boolean
  sourcePath: string
}): Observable<string> => {
  const targetParentPath = dirname(sourcePath)

  return new Observable<string>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFiles({ sourcePath })
      .pipe(
        // Materialize the file list so we can stat upfront for the
        // emitter's totalBytes, AND know totalFiles. Skipped if there's
        // no active job context (CLI mode) — the per-file copy still
        // runs, just without progress emission.
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
                // Per-file copies go through the global Task scheduler —
                // see copyFiles.ts for the full rationale.
                runTasks(({ file, size }) => {
                  const targetPath = join(
                    targetParentPath,
                    basename(file.fullPath),
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

                  return defer(() =>
                    aclSafeCopyFile(
                      file.fullPath,
                      targetPath,
                      copyOptions,
                    ),
                  ).pipe(
                    tap(() => {
                      logInfo(
                        "COPIED BACK",
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
        toArray(),
        concatMap(() => {
          if (isDeletingSourceFolder) {
            return defer(() =>
              rm(sourcePath, { recursive: true }),
            ).pipe(
              tap(() => {
                logInfo("REMOVED OUTPUT FOLDER", sourcePath)
              }),
              map(() => sourcePath),
            )
          }
          return of(sourcePath)
        }),
        logAndRethrowPipelineError(flattenOutput),
      )
      .subscribe(subscriber)

    return () => {
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
}
