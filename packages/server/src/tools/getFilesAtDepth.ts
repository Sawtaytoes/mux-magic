import { concat, concatMap, EMPTY, filter, iif } from "rxjs"
import { getFiles } from "./getFiles.js"
import { getFolder } from "./getFolder.js"
import { logPipelineError } from "./logPipelineError.js"

export const getFilesAtDepth = ({
  depth,
  sourcePath,
}: {
  depth: number
  sourcePath: string
}): ReturnType<typeof getFiles> =>
  concat(
    getFiles({
      sourcePath,
    }),
    iif(
      () => depth > 0,
      getFolder({
        sourcePath,
      }).pipe(
        concatMap((folderInfo) =>
          getFilesAtDepth({
            depth: depth - 1,
            sourcePath: folderInfo.fullPath,
          }),
        ),
        filter(Boolean),
      ),
      EMPTY,
    ),
  ).pipe(logPipelineError(getFilesAtDepth))
