import {
  cpus,
} from "node:os"
import {
  concatMap,
  filter,
  map,
  tap,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  getMediaInfo,
  type TextTrack,
} from "../tools/getMediaInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const isMissingSubtitles = ({
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
    filterIsVideoFile(),
    withFileProgress((
      fileInfo,
    ) => (
      getMediaInfo(
        fileInfo
        .fullPath
      )
      .pipe(
        filter(
          Boolean
        ),
        map(({
          media,
        }) => (
          media
        )),
        filter(
          Boolean
        ),
        concatMap(({
          track,
        }) => (
          track
        )),
        filter((
          track,
        ): track is TextTrack => (
          (
            track
            ["@type"]
          )
          === "Text"
        )),
        tap(() => {
          console
          .info(
            fileInfo
            .filename
          )
        }),
      )
    ), { concurrency: cpus().length }),
    logAndRethrow(
      isMissingSubtitles
    ),
  )
)
