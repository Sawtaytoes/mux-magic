import { rename, stat, unlink } from "node:fs/promises"
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
import {
  compileFilterRegex,
  compileRegexValue,
  type RegexFilterInput,
} from "./copyFiles.js"

type MoveRecord = {
  source: string
  destination: string
}

const hasErrorCode = (
  error: unknown,
  code: string,
): boolean =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === code

const buildExistsError = (
  destination: string,
): Error & { code: string } => {
  const error = new Error(
    `Refusing to overwrite existing destination: ${destination}`,
  ) as Error & { code: string }
  error.code = "EEXIST"
  return error
}

const checkDestination = async (
  destination: string,
  isOverwriteAllowed: boolean,
): Promise<boolean> => {
  try {
    await stat(destination)
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false
    throw error
  }
  if (!isOverwriteAllowed)
    throw buildExistsError(destination)
  return true
}

// Same-volume rename short-circuit: metadata-only O(1) move. EXDEV
// (cross-volume) triggers the streaming-copy fallback, which retains
// per-byte progress and the AbortController wiring.
const moveSingleFile = async ({
  sourcePath,
  destinationPath,
  isOverwriteAllowed,
  copyOptions,
}: {
  sourcePath: string
  destinationPath: string
  isOverwriteAllowed: boolean
  copyOptions: CopyOptions
}): Promise<"renamed" | "copied"> => {
  const hasExistingDestination = await checkDestination(
    destinationPath,
    isOverwriteAllowed,
  )
  if (hasExistingDestination) {
    // On Windows `rename` errors with EPERM against an existing
    // target; the EXDEV fallback's aclSafeCopyFile already handles
    // its own destination-exists case via the same temp+rename
    // primitive, so we only need to clear the path here for the
    // rename fast-path.
    await unlink(destinationPath).catch((error) => {
      if (hasErrorCode(error, "ENOENT")) return
      throw error
    })
  }
  try {
    await rename(sourcePath, destinationPath)
    return "renamed"
  } catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error
    // Cross-volume: stream the bytes, then drop the source entry.
    // aclSafeCopyFile is already temp+rename + EEXIST-safe; pass
    // isOverwriteAllowed through so it doesn't re-trip on the same
    // destination check we just made.
    await aclSafeCopyFile(sourcePath, destinationPath, {
      ...copyOptions,
      isOverwriteAllowed: true,
    })
    await unlink(sourcePath)
    return "copied"
  }
}

// Copies every matching file in `sourcePath` into `destinationPath`,
// preferring an O(1) `fs.rename` on same-volume moves and falling
// back to a streaming copy + per-file unlink on EXDEV. Emits a per-
// file `{ source, destination }` record so the builder's Results
// panel can show a readable "old → new" summary.
//
// Wraps the inner pipeline in an AbortController-aware Observable
// for the same reason `copyFiles` does: an unsubscribe (sequence
// cancel, parallel sibling fail-fast) must interrupt an in-flight
// EXDEV-fallback stream copy mid-byte instead of letting the
// remaining gigabytes finish.
//
// Worker 59 dropped the trailing `rm -r sourcePath` that used to run
// after every move — it could destroy unrelated files in the source
// directory that didn't match `fileFilterRegex`. Source-directory
// cleanup belongs in `deleteFilesByExtension` + `deleteEmptyFolders`
// (or `flattenChildFolders`), not bundled into the move primitive.
export const moveFiles = ({
  destinationPath,
  fileFilterRegex,
  renameRegex,
  sourcePath,
  isOverwriteAllowed = false,
}: {
  destinationPath: string
  fileFilterRegex?: RegexFilterInput
  renameRegex?: RenameRegex
  sourcePath: string
  isOverwriteAllowed?: boolean
}): Observable<MoveRecord> => {
  // Pre-validate at handler start (synchronously, outside the
  // Observable ctor) so a bad pattern/flag surfaces named and
  // explained at the call site, not as an unhandled rxjs error
  // notification or per-file SyntaxError mid-job. See copyFiles.ts
  // for the same shape.
  const fileFilterCompiled = compileFilterRegex(
    fileFilterRegex,
    "fileFilterRegex",
  )
  if (renameRegex !== undefined) {
    compileRegexValue(renameRegex, "renameRegex")
  }

  return new Observable<MoveRecord>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFiles({ sourcePath })
      .pipe(
        // Materialize the file list so we can stat upfront for the
        // emitter's totalBytes, AND know totalFiles. Skipped if
        // there's no active job context (CLI mode) — the per-file
        // move still runs, just without progress emission.
        toArray(),
        concatMap((allFiles) =>
          defer(async () => {
            const files =
              fileFilterCompiled === undefined
                ? allFiles
                : allFiles.filter((file) =>
                    fileFilterCompiled.test(
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
                // Per-file moves go through the global Task
                // scheduler — see copyFiles.ts for the full
                // rationale.
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

                  // For the EXDEV fallback only. aclSafeCopyFile's
                  // onProgress fires per chunk with ABSOLUTE
                  // bytesWritten, so we track the previous high-water
                  // mark and report deltas to the tracker.
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
                      defer(() =>
                        moveSingleFile({
                          sourcePath: file.fullPath,
                          destinationPath:
                            destinationFilePath,
                          isOverwriteAllowed,
                          copyOptions,
                        }),
                      ),
                    ),
                    tap((mode) => {
                      logInfo(
                        mode === "renamed"
                          ? "MOVED"
                          : "COPIED",
                        file.fullPath,
                        destinationFilePath,
                      )
                      // Rename has no per-byte callback to drive the
                      // tracker, so credit the full file size once
                      // here. The EXDEV fallback already credited
                      // bytes per chunk via copyOptions.onProgress.
                      if (
                        mode === "renamed" &&
                        tracker !== null
                      ) {
                        tracker.reportBytes(size)
                      }
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
        logAndRethrowPipelineError(moveFiles),
      )
      .subscribe(subscriber)

    return () => {
      // Order: abort first so an in-flight pipeline rejects via
      // AbortError rather than a downstream EBADF when streams are
      // torn down out from under it; then unsubscribe to stop
      // further emissions.
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
}
