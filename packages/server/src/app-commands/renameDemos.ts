import {
  mergeMap,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getDemoName } from "../tools/getDemoName.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const renameDemos = ({
  isRecursive,
  sourcePath,
}: {
  isRecursive: boolean
  sourcePath: string
}) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? 1
      : 0
    ),
    sourcePath,
  })
  .pipe(
    withFileProgress((fileInfo) => (
      getMediaInfo(
        fileInfo
        .fullPath
      )
      .pipe(
        mergeMap((
          mediaInfo,
        ) => (
          getDemoName({
            filename: (
              fileInfo
              .filename
            ),
            mediaInfo,
          })
        )),
        mergeMap((
          renamedFilename,
        ) => (
          fileInfo
          .renameFile(
            renamedFilename
          )
        )),
      )
    ), { concurrency: Infinity }),
    logAndRethrow(
      renameDemos
    )
  )
)
