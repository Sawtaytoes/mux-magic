import { unlink } from "node:fs/promises"
import { extname } from "node:path"
import { defer, filter, map, tap } from "rxjs"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export type DeleteFilesByExtensionRequiredProps = {
  isRecursive: boolean
  extensions: string[]
  sourcePath: string
}

export type DeleteFilesByExtensionOptionalProps = {
  recursiveDepth?: number
}

export type DeleteFilesByExtensionProps =
  DeleteFilesByExtensionRequiredProps &
    DeleteFilesByExtensionOptionalProps

export const deleteFilesByExtension = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
  extensions,
}: DeleteFilesByExtensionProps) => {
  const normalizedExtensions = extensions
    .map((extension) =>
      extension.toLowerCase().replace(/^\./u, ""),
    )
    .filter(Boolean)

  return getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 2 : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) => {
      const fileExtension = extname(fileInfo.fullPath)
        .toLowerCase()
        .replace(/^\./u, "")

      return normalizedExtensions.includes(fileExtension)
    }),
    withFileProgress((fileInfo) =>
      defer(() => unlink(fileInfo.fullPath)).pipe(
        tap(() => {
          logInfo("DELETED FILE", fileInfo.fullPath)
        }),
        map(() => fileInfo.fullPath),
      ),
    ),
    logAndRethrow(deleteFilesByExtension),
  )
}
