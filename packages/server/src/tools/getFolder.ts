import {
  readdir,
  stat,
} from "node:fs/promises"
import { join } from "node:path"
import {
  catchError,
  concatAll,
  concatMap,
  defer,
  EMPTY,
  filter,
  from,
  map,
  OperatorFunction,
  toArray,
  type Observable,
} from "rxjs"

import { createRenameFileOrFolderObservable } from "./createRenameFileOrFolder.js"
import { logPipelineError } from "./logPipelineError.js"

export type FolderInfo = {
  folderName: (
    string
  ),
  fullPath: (
    string
  ),
  renameFolder: (
    newFolderName: string,
  ) => (
    Observable<{
      newPath: string
      oldPath: string
    }>
  )
}

export const getIsFolder = (
  folderPath: string
) => (
  from(
    stat(
      folderPath
    )
  )
  .pipe(
    filter((
      stats
    ) => (
      stats
      .isDirectory()
    )),
  )
)

export const filterFolderAtPath = <
  PipelineValue
>(
  getFullPath: (
    pipelineValue: PipelineValue
  ) => string
): (
  OperatorFunction<
    PipelineValue,
    PipelineValue
  >
) => (
  concatMap((
    pipelineValue,
  ) => (
    from(
      stat(
        getFullPath(
          pipelineValue
        )
      )
    )
    .pipe(
      filter((
        stats
      ) => (
        stats
        .isDirectory()
      )),
      map(() => (
        pipelineValue
      )),
      catchError((error) => {
        if (error.code === 'ENOENT') {
          return EMPTY
        }

        throw error
      }),
    )
  ))
)

export const getFolder = ({
  sourcePath,
}: {
  sourcePath: string,
}): (
  Observable<
    FolderInfo
  >
) => (
  defer(() => (
    readdir(
      sourcePath
    )
  ))
  .pipe(
    concatAll(),
    map((
      folderName,
    ) => ({
      folderName,
      fullPath: (
        join(
          sourcePath,
          folderName,
        )
      ),
    })),
    filterFolderAtPath(({
      fullPath
    }) => (
      fullPath
    )),
    map(({
      folderName,
      fullPath,
    }) => ({
      folderName,
      fullPath,
      renameFolder: (
        createRenameFileOrFolderObservable({
          fullPath,
          sourcePath,
        })
      ),
    } satisfies (
      FolderInfo
    ) as (
      FolderInfo
    ))),
    logPipelineError(
      getFolder
    ),
  )
)
