import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
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
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const hasWrongDefaultTrack = ({
  isRecursive,
  sourcePath,
}: {
  isRecursive: boolean
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      getMkvInfo(fileInfo.fullPath).pipe(
        concatMap(({ tracks }) =>
          from(tracks).pipe(
            groupBy((track) => track.type),
            mergeMap((group$) =>
              group$.pipe(
                toArray(),
                filter(
                  (groupedTracks) =>
                    groupedTracks.length > 1,
                ),
                concatAll(),
                take(1),
                filter(
                  ({ properties }) =>
                    !properties.isDefaultTrack,
                ),
              ),
            ),
            toArray(),
            tap((trackGroups) => {
              logInfo(
                "WRONG DEFAULT TRACK",
                fileInfo.fullPath,
                "Wrong Default Track: ".concat(
                  trackGroups
                    .map(({ type }) => type)
                    .join(", "),
                ),
              )
            }),
          ),
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(hasWrongDefaultTrack),
  )
