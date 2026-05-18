import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { concatMap, of, toArray } from "rxjs"
import { convertVariableToConstantBitrate } from "../cli-spawn-operations/convertVariableToConstantBitrate.js"
import {
  inverseTelecineVideo,
  type Pulldown,
  type VideoEncoder,
} from "../cli-spawn-operations/inverseTelecineVideo.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"

/**
 * @experimental This doesn't work correctly and will probably be removed in the future unless something different than ffmpeg is used.
 */
export const inverseTelecineDiscRips = ({
  isConstantBitrate,
  isRecursive,
  sourcePath,
  pulldown,
  videoEncoder,
}: {
  isConstantBitrate: boolean
  isRecursive: boolean
  sourcePath: string
  pulldown: Pulldown
  videoEncoder: VideoEncoder
}) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      (isConstantBitrate
        ? of(fileInfo.fullPath)
        : // DVDs have variable framerate, so you first need to set it to Constant in the video track before performing an inverse telecine.
          convertVariableToConstantBitrate({
            filePath: fileInfo.fullPath,
            framesPerSecond: "24000/1001",
          })
      ).pipe(
        concatMap((filePath) =>
          inverseTelecineVideo({
            filePath,
            pulldown,
            videoEncoder,
          }),
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(inverseTelecineDiscRips),
  )
