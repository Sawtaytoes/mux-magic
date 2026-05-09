import {
  EMPTY,
  filter,
  map,
  mergeMap,
  of,
  tap,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const hasImaxEnhancedAudio = ({
  isRecursive,
  sourcePath,
}: {
  isRecursive: boolean,
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
        mergeMap(({
          track,
        }) => (
          track
        )),
        mergeMap((
          track,
        ) => (
          (
            (
              track
              ["@type"]
            )
            === "Audio"
          )
          ? (
            of(
              track
            )
          )
          : EMPTY
        )),
        filter(({
          "Format_AdditionalFeatures": additionalFeatures,
        }) => (
          additionalFeatures
          === "XLL X IMAX"
        )),
        tap(() => {
          console
          .info(
            fileInfo
            .filename
          )
        }),
      )
    ), { concurrency: Infinity }),
    logAndRethrow(
      hasImaxEnhancedAudio
    ),
  )
)
