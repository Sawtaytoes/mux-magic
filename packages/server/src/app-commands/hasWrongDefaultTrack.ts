import colors from "ansi-colors"
import {
  concatAll,
  concatMap,
  filter,
  from,
  groupBy,
  mergeMap,
  take,
  tap,
  toArray,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const hasWrongDefaultTrack = ({
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
      getMkvInfo(
        fileInfo
        .fullPath
      )
      .pipe(
        concatMap(({
          tracks
        }) => (
          from(
            tracks
          )
          .pipe(
            groupBy((
              track,
            ) => (
              track
              .type
            )),
            mergeMap((
              group$,
            ) => (
              group$
              .pipe(
                toArray(),
                filter((
                  groupedTracks,
                ) => (
                  (
                    groupedTracks
                    .length
                  )
                  > 1
                )),
                concatAll(),
                take(1),
                filter(({
                  properties,
                }) => (
                  !(
                    properties
                    .default_track
                  )
                )),
              )
            )),
            toArray(),
            tap((
              trackGroups,
            ) => {
              console
              .info(
                (
                  fileInfo
                  .fullPath
                ),
                "\n",
                (
                  colors
                  .bold
                  .cyan(
                    "Wrong Default Track:"
                  )
                ),
                (
                  trackGroups
                  .map(({
                    type,
                  }) => (
                    type
                  ))
                  .join(", ")
                ),
                "\n",
              )
            }),
          )
        )),
      )
    )),
    toArray(),
    logAndRethrow(
      hasWrongDefaultTrack
    ),
  )
)
