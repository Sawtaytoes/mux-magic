import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { map, toArray } from "rxjs"
import { setOnlyFirstTracksAsDefault } from "../cli-spawn-operations/setOnlyFirstTracksAsDefault.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const fixIncorrectDefaultTracks = ({
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
    // Per-file: run setOnlyFirstTracksAsDefault, swallow its 0-N inner
    // emissions with toArray, then emit one { filePath, modificationCount }
    // record so job.results lists every video that was inspected (and
    // how many tracks were retouched), not a chain of nulls.
    withFileProgress((fileInfo) =>
      setOnlyFirstTracksAsDefault({
        filePath: fileInfo.fullPath,
      }).pipe(
        toArray(),
        map((emissions) => ({
          filePath: fileInfo.fullPath,
          modificationCount: emissions.length,
        })),
      ),
    ),
    logAndRethrowPipelineError(fixIncorrectDefaultTracks),
  )
