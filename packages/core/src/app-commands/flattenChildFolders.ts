import { rm } from "node:fs/promises"
import { basename, join } from "node:path"
import {
  type FileInfo,
  getFiles,
  getFolder,
  logAndRethrowPipelineError,
  logInfo,
  renameFileOrFolder,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  from,
  map,
  type Observable,
  tap,
  toArray,
} from "rxjs"

type FlattenRecord = {
  source: string
  destination: string
}

// For each immediate child directory of `parentPath`, moves every file inside
// that child up to `parentPath`. Distinct from `flattenOutput`, which operates
// on a SINGLE folder and moves its contents one level up — this command
// iterates over every child folder instead. Ported from the user's PowerShell
// "flatten children to parent" script for disc-rip workflows where each disc
// landed in its own subdir.
//
// Same-volume by construction (the moves stay inside `parentPath`'s tree), so
// renames go through the atomic `fs.rename` path rather than a byte copy. No
// AbortController wrap — there's no in-flight stream to interrupt and the
// inner unsubscribe is enough to stop further per-file renames.
//
// Does NOT recurse into grandchildren — only immediate child directories'
// own top-level files are moved up. Files already at `parentPath` are
// untouched (they're not yielded by `getFolder`).
export const flattenChildFolders = ({
  isDeletingEmptyChildFoldersAfterFlattening = false,
  parentPath,
}: {
  isDeletingEmptyChildFoldersAfterFlattening?: boolean
  parentPath: string
}): Observable<FlattenRecord> =>
  getFolder({ sourcePath: parentPath }).pipe(
    concatMap((childFolder) =>
      getFiles({ sourcePath: childFolder.fullPath }).pipe(
        concatMap((file: FileInfo) => {
          const destination = join(
            parentPath,
            basename(file.fullPath),
          )
          return renameFileOrFolder({
            newPath: destination,
            oldPath: file.fullPath,
          }).pipe(
            tap(() => {
              logInfo(
                "FLATTENED",
                file.fullPath,
                destination,
              )
            }),
            map(
              (): FlattenRecord => ({
                source: file.fullPath,
                destination,
              }),
            ),
          )
        }),
        toArray(),
        concatMap((moves) => {
          if (!isDeletingEmptyChildFoldersAfterFlattening) {
            return from(moves)
          }
          return defer(() =>
            rm(childFolder.fullPath, { recursive: true }),
          ).pipe(
            tap(() => {
              logInfo(
                "REMOVED EMPTY CHILD",
                childFolder.fullPath,
              )
            }),
            concatMap(() => from(moves)),
          )
        }),
      ),
    ),
    logAndRethrowPipelineError(flattenChildFolders),
  )
