import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { tap, toArray } from "rxjs"
import { setDisplayWidthMkvPropEdit } from "../cli-spawn-operations/setDisplayWidthMkvPropEdit.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const setDisplayWidth = ({
  displayWidth,
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  displayWidth: number
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    withFileProgress((fileInfo) =>
      setDisplayWidthMkvPropEdit({
        displayWidth,
        filePath: fileInfo.fullPath,
      }).pipe(
        tap((outputFilePath) => {
          logInfo(
            "SET DISPLAY WIDTH IN FILE",
            outputFilePath,
          )
        }),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(setDisplayWidth),
  )
