import { extname, join } from "node:path"
import {
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
  renameFileOrFolder,
} from "@mux-magic/tools"
import {
  concatMap,
  map,
  type Observable,
  of,
  tap,
} from "rxjs"

type MoveRecord = {
  source: string
  destination: string
}

// Foldarizes a directory: for each file in `sourcePath`, creates a same-named
// subdirectory (with the file's extension stripped) and moves the file into
// it. `Casper.mkv` → `Casper/Casper.mkv`. Pre-existing subdirectories are
// untouched (getFiles only yields files), and files with no extension produce
// a folder name equal to the full filename (`README` → `README/README`).
//
// Source and destination always share a parent, so the underlying fs.rename
// is an atomic same-volume metadata op — near-instant even on 50GB MKVs.
// No AbortController wrap here (cf. flattenOutput / moveFiles): there's no
// in-flight byte stream to interrupt, and unsubscribing the inner pipeline is
// enough to stop further per-file renames.
//
// No-extension case: the file already occupies the path we want for the
// target folder (`/src/README` is both the file and the folder-to-be), so we
// stash the file at a sibling temp path first, then mkdir, then rename into
// place. Files with an extension don't collide and take the single-step path.
export const moveFilesIntoNamedFolders = ({
  sourcePath,
}: {
  sourcePath: string
}): Observable<MoveRecord> =>
  getFiles({ sourcePath }).pipe(
    concatMap((file) => {
      const fileExtension = extname(file.fullPath)
      const folderName = file.filename
      const targetFolder = join(sourcePath, folderName)
      const destination = join(
        targetFolder,
        folderName.concat(fileExtension),
      )
      const hasExtension = fileExtension !== ""
      const stagingPath = hasExtension
        ? file.fullPath
        : file.fullPath.concat(".foldarize-tmp")

      const stageRename: Observable<unknown> = hasExtension
        ? of(null)
        : renameFileOrFolder({
            newPath: stagingPath,
            oldPath: file.fullPath,
          }).pipe(map(() => null))

      return stageRename.pipe(
        concatMap(() => makeDirectory(targetFolder)),
        concatMap(() =>
          renameFileOrFolder({
            newPath: destination,
            oldPath: stagingPath,
          }),
        ),
        tap(() => {
          logInfo(
            "MOVED INTO FOLDER",
            file.fullPath,
            destination,
          )
        }),
        map(() => ({
          source: file.fullPath,
          destination,
        })),
      )
    }),
    logAndRethrowPipelineError(moveFilesIntoNamedFolders),
  )
