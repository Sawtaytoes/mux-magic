import {
  getFiles,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { renameListedFile } from "../tools/guardedFileWrites.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const renameMovieClipDownloads = ({
  sourcePath,
}: {
  sourcePath: string
}) =>
  getFiles({
    sourcePath,
  }).pipe(
    withFileProgress(
      (fileInfo) =>
        renameListedFile({
          fileInfo,
          renamedFilename: fileInfo.filename
            .replace(
              /(.+) \[(\d+)\] \((.+)\) (.+)\.(.{3})/,
              "$1 ($2) [$3] {$4}.$5",
            )
            .replace(/(.+) \(\w+\)-\d{3}/, "$1")
            .replace(/(.+)-\d{3}/, "$1")
            .replace(/(.+) \d+bits/, "$1")
            .replace(/(.+) \d+bits/, "$1"),
        }),
      { concurrency: Infinity },
    ),
    logAndRethrowPipelineError(renameMovieClipDownloads),
  )
