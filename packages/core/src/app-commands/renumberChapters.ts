import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { renumberChaptersInFile } from "../tools/renumberChaptersInFile.js"

export type { RenumberChaptersResult } from "../tools/renumberChaptersInFile.js"

export const renumberChapters = ({
  isPaddingChapterNumbers,
  isRecursive,
  sourcePath,
}: {
  isPaddingChapterNumbers: boolean
  isRecursive: boolean
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      renumberChaptersInFile({
        filePath: fileInfo.fullPath,
        isPaddingChapterNumbers,
      }),
    ),
    logAndRethrowPipelineError(renumberChapters),
  )
