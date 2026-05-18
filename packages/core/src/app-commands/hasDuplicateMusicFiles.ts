import { basename, dirname, join } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  groupBy,
  map,
  mergeMap,
  skip,
  take,
  tap,
} from "rxjs"
import { filterIsAudioFile } from "../tools/filterIsAudioFile.js"

export const hasDuplicateMusicFiles = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filterIsAudioFile(),
    map((fileInfo) => fileInfo.fullPath),
    groupBy((filePath) =>
      join(
        dirname(filePath),
        basename(filePath)
          .replace(/(.+)( \(\d\))/, "$1")
          .replace(/(.+)( - Copy)/, "$1")
          .replace(/^(.+)\..+$/, "$1"),
      ),
    ),
    mergeMap((groupObservable) =>
      groupObservable.pipe(
        skip(1),
        take(2),
        map(() => groupObservable.key),
      ),
    ),
    map((filePath) => dirname(filePath)),
    groupBy(
      (directoryWithDuplicates) => directoryWithDuplicates,
    ),
    mergeMap((groupObservable) =>
      groupObservable.pipe(take(1)),
    ),
    tap((directoryWithDuplicates) => {
      logInfo(
        "DUPLICATE MUSIC FILES",
        directoryWithDuplicates,
      )
    }),
    logAndRethrowPipelineError(hasDuplicateMusicFiles),
  )
