import { rm, stat } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  concatMap,
  defer,
  finalize,
  from,
  map,
  tap,
  toArray,
} from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"
import { aclSafeCopyFile } from "../tools/aclSafeCopyFile.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { makeDirectory } from "../tools/makeDirectory.js"
import { createProgressEmitter } from "../tools/progressEmitter.js"
import { runTasks } from "../tools/taskScheduler.js"

// Copies every file in `sourcePath` into `destinationPath`, then removes
// the source directory once all copies succeed. Emits a per-file
// `{ source, destination }` record so the builder's Results panel can
// show a readable "old → new" summary instead of a string of nulls.
export const moveFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => (
  getFiles({ sourcePath })
  .pipe(
    // Materialize the file list so we can stat upfront for the
    // emitter's totalBytes, AND know totalFiles. Skipped if there's
    // no active job context (CLI mode) — the per-file copy still
    // runs, just without progress emission.
    toArray(),
    concatMap((files) => (
      defer(async () => {
        const jobId = getActiveJobId()
        const sizes = (
          jobId !== undefined
          ? await Promise.all(files.map((file) => stat(file.fullPath).then((stats) => stats.size)))
          : []
        )
        const totalBytes = sizes.reduce((sum, size) => sum + size, 0)
        const emitter = (
          jobId !== undefined
          ? createProgressEmitter(jobId, { totalFiles: files.length, totalBytes })
          : null
        )
        return { files, sizes, emitter }
      })
      .pipe(
        concatMap(({ files, sizes, emitter }) => (
          from(files.map((file, index) => ({ file, size: sizes[index] })))
          .pipe(
            // Per-file copies go through the global Task scheduler — see
            // copyFiles.ts for the full rationale.
            runTasks(({ file, size }) => {
              const destinationFilePath = join(
                destinationPath,
                file.filename.concat(extname(file.fullPath)),
              )

              const tracker = (
                emitter !== null
                ? emitter.startFile(file.fullPath, size)
                : null
              )

              // aclSafeCopyFile.onProgress fires per chunk with
              // ABSOLUTE bytesWritten across the lifetime of one
              // file copy. The tracker's reportBytes wants per-chunk
              // delta, so we track the previous high-water mark.
              let lastBytesWritten = 0

              return makeDirectory(destinationPath)
              .pipe(
                concatMap(() => aclSafeCopyFile(
                  file.fullPath,
                  destinationFilePath,
                  tracker !== null
                    ? {
                        onProgress: (event) => {
                          const delta = event.bytesWritten - lastBytesWritten
                          lastBytesWritten = event.bytesWritten
                          tracker.reportBytes(delta)
                        },
                      }
                    : undefined,
                )),
                tap(() => {
                  logInfo("COPIED", file.fullPath, destinationFilePath)
                }),
                map(() => ({
                  source: file.fullPath,
                  destination: destinationFilePath,
                })),
                finalize(() => tracker?.finish(size)),
              )
            }),
            finalize(() => emitter?.finalize()),
          )
        )),
      )
    )),
    // Buffer the per-file move records so the source-dir removal only
    // runs after every copy finished. Re-emit them downstream once rm
    // resolves so callers (and the API job runner) see the full set.
    toArray(),
    concatMap((moves) => (
      defer(() => rm(sourcePath, { recursive: true }))
      .pipe(
        tap(() => {
          logInfo("DELETED", sourcePath)
        }),
        concatMap(() => from(moves)),
      )
    )),
    logAndRethrow(moveFiles),
  )
)
