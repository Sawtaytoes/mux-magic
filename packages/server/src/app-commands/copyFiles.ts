import { cp, readdir, stat } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  aclSafeCopyFile,
  type CopyOptions,
  getFiles,
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

// Object-form regex input shared by `fileFilterRegex` / `folderFilterRegex`
// (without `replacement`) and `renameRegex` (with it). `flags` plumbs
// into `new RegExp(pattern, flags)`; `sample` is UI-only documentation
// the runtime ignores.
export type RegexFilterValue = {
  pattern: string
  flags?: string
  sample?: string
}

export type RenameRegex = RegexFilterValue & {
  replacement: string
}

// Pre-flags wire format was a bare string for filters and a 2-key object
// for rename. Both are still accepted at the handler boundary so direct
// callers (CLI, tests) don't have to rewrite their fixtures.
export type RegexFilterInput = string | RegexFilterValue

export const normalizeRegexFilter = (
  input: RegexFilterInput | undefined,
): RegexFilterValue | undefined => {
  if (input === undefined) return undefined
  return typeof input === "string"
    ? { pattern: input }
    : input
}

// Validate at handler-start time (not per-file) so an invalid pattern or
// flag set surfaces with the user's actual values in the error message,
// instead of as a generic `SyntaxError` mid-job.
export const compileRegexValue = (
  value: RegexFilterValue,
  fieldLabel: string,
): RegExp => {
  try {
    return new RegExp(value.pattern, value.flags)
  } catch (cause) {
    const flagsSuffix = value.flags
      ? ` (flags: "${value.flags}")`
      : ""
    throw new Error(
      `Invalid regex on ${fieldLabel}: /${value.pattern}/${flagsSuffix} — ${
        cause instanceof Error
          ? cause.message
          : String(cause)
      }`,
    )
  }
}

// Convenience for the common normalize-then-compile pair every handler
// needs. Returns `undefined` when the input is missing so callers can use
// `=== undefined` instead of guarding twice.
export const compileFilterRegex = (
  input: RegexFilterInput | undefined,
  fieldLabel: string,
): RegExp | undefined => {
  const value = normalizeRegexFilter(input)
  return value === undefined
    ? undefined
    : compileRegexValue(value, fieldLabel)
}

export const applyRenameRegex = (
  name: string,
  renameRegex: RenameRegex | undefined,
): string =>
  renameRegex
    ? name.replace(
        new RegExp(renameRegex.pattern, renameRegex.flags),
        renameRegex.replacement,
      )
    : name

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
  fileFilterRegex?: RegexFilterInput
  folderFilterRegex?: RegexFilterInput
  isIncludingFolders?: boolean
  renameRegex?: RenameRegex
  sourcePath: string
}): Observable<CopyRecord> => {
  // Pre-validate every regex once, synchronously, before the Observable
  // is even constructed. A bad pattern or flag surfaces as a sync throw
  // from the call site (with the field name + pattern in the message)
  // instead of as a per-file SyntaxError mid-job or an unhandled rxjs
  // error notification.
  const fileFilterCompiled = compileFilterRegex(
    fileFilterRegex,
    "fileFilterRegex",
  )
  const folderFilterCompiled = compileFilterRegex(
    folderFilterRegex,
    "folderFilterRegex",
  )
  if (renameRegex !== undefined) {
    compileRegexValue(renameRegex, "renameRegex")
  }

  return new Observable<CopyRecord>((subscriber) => {
    const abortController = new AbortController()

    // File copy pipeline: uses getFiles() for the flat file listing so
    // existing behaviour is preserved. Adds optional regex filter and
    // rename on top.
    // When includeFolders is true, files are only copied if fileFilterRegex
    // is explicitly set — otherwise the command operates in folder-only mode.
    const filesCopy$ =
      isIncludingFolders && fileFilterCompiled === undefined
        ? EMPTY
        : getFiles({ sourcePath }).pipe(
            toArray(),
            concatMap((files) =>
              defer(async () => {
                const filteredFiles =
                  fileFilterCompiled === undefined
                    ? files
                    : files.filter((file) =>
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
              folderFilterCompiled === undefined ||
              folderFilterCompiled.test(entry.name),
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
}
