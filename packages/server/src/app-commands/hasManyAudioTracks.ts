import {
  concatMap,
  count,
  EMPTY,
  filter,
  map,
  of,
  tap,
} from "rxjs"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const hasManyAudioTracks = ({
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
    withFileProgress(
      (fileInfo) =>
        getMediaInfo(fileInfo.fullPath).pipe(
          filter(Boolean),
          map(({ media }) => media),
          filter(Boolean),
          concatMap(({ track }) => track),
          concatMap((track) =>
            track["@type"] === "Audio" ? of(track) : EMPTY,
          ),
          count(),
          filter((count) => count > 2),
          tap((count) => {
            console.info(count, fileInfo.fullPath)
          }),
        ),
      { concurrency: Infinity },
    ),
    logAndRethrow(hasManyAudioTracks),
  )
