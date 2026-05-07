import { stat } from "node:fs/promises"
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

export const copyFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => (
  getFiles({ sourcePath })
  .pipe(
    // Materialize the file list so we know totalFiles + can stat for
    // totalBytes upfront. The cost is N stats and holding N small
    // FileInfo structs in memory; both are cheap relative to the
    // bytes we're about to move.
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
            // Per-file copies go through the global Task scheduler — at
            // MAX_THREADS=N, up to N copies run concurrently. Each gets
            // its own FileTracker so the UI shows one row per active
            // copy (path + percent), and the tracker.finish() in the
            // finalize ensures slot release on cancel.
            runTasks(({ file, size }) => {
              const targetPath = join(
                destinationPath,
                file.filename.concat(extname(file.fullPath)),
              )

              const tracker = (
                emitter !== null
                ? emitter.startFile(file.fullPath, size)
                : null
              )

              // aclSafeCopyFile.onProgress fires per chunk with
              // ABSOLUTE bytesWritten across the lifetime of one file
              // copy. The tracker's reportBytes wants per-chunk delta,
              // so we track the previous high-water mark per file.
              let lastBytesWritten = 0

              return makeDirectory(destinationPath)
              .pipe(
                concatMap(() => aclSafeCopyFile(
                  file.fullPath,
                  targetPath,
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
                  logInfo("COPIED", file.fullPath, targetPath)
                }),
                map(() => targetPath),
                finalize(() => tracker?.finish(size)),
              )
            }),
            finalize(() => emitter?.finalize()),
          )
        )),
      )
    )),
    logAndRethrow(copyFiles),
  )
)
