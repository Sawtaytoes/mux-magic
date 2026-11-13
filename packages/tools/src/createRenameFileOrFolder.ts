import {
  link,
  lstat,
  open,
  rename,
  stat,
  unlink,
} from "node:fs/promises"
import { basename, extname, join, resolve } from "node:path"
import {
  concatMap,
  defer,
  filter,
  map,
  type Observable,
  of,
  tap,
} from "rxjs"

import { hasErrorCode } from "./hasErrorCode.js"
import { logAndSwallowPipelineError } from "./logAndSwallowPipelineError.js"
import { logInfo } from "./logMessage.js"

export const getLastItemInFilePath = (filePath: string) =>
  basename(filePath, extname(filePath))

const buildAlreadyExistsMessage = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}) =>
  "File or folder already exists for".concat(
    " ",
    '"',
    getLastItemInFilePath(newPath),
    '".',
    " ",
    `Cannot rename "${oldPath}".`,
  )

// Target paths that a rename in this process is moving into right now.
// Commands such as nameAnimeEpisodes rename many files at unlimited
// concurrency, so two files that map to the same name would both pass
// the "is it free?" check before either rename lands, and the second
// rename would replace the first file. Claiming the name here first
// makes the second rename fail instead.
const claimedTargetPaths = new Set<string>()

// Only a missing target means the name is free. Any other error
// (EACCES, EIO, ENOTDIR) is a real failure to report, not a reason to
// rename over whatever is there.
const isTargetAbsent = (newPath: string) =>
  stat(newPath).then(
    () => false,
    (error: unknown) =>
      hasErrorCode(error, "ENOENT")
        ? true
        : Promise.reject(error),
  )

// Removes the empty placeholder this rename created, but only while it
// is still empty, so a file someone else wrote there is never deleted.
const removeEmptyPlaceholder = (newPath: string) =>
  stat(newPath)
    .then((stats) =>
      stats.isFile() && stats.size === 0
        ? unlink(newPath)
        : undefined,
    )
    .catch(() => undefined)

// Without hard links, the name is claimed by creating an empty file with
// the exclusive `wx` flag, which fails with EEXIST when the name is
// taken. The source then renames over this placeholder. A failed rename
// removes the placeholder again.
const moveFileThroughPlaceholder = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}) =>
  open(newPath, "wx").then(
    (fileHandle) =>
      fileHandle
        .close()
        .then(() =>
          rename(oldPath, newPath).catch(
            (renameError: unknown) =>
              removeEmptyPlaceholder(newPath).then(() =>
                Promise.reject(renameError),
              ),
          ),
        ),
    (error: unknown) =>
      hasErrorCode(error, "EEXIST")
        ? Promise.reject(
            buildAlreadyExistsMessage({ newPath, oldPath }),
          )
        : Promise.reject(error),
  )

// For a file, `link` fails with EEXIST when the name is taken, and the
// kernel checks and creates the name in one step, so another process
// cannot slip a file in between. A file system without hard links
// claims the name with an exclusive placeholder instead. Neither path
// can replace a file another writer put there.
const moveFileIntoFreeName = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}) =>
  link(oldPath, newPath).then(
    () => unlink(oldPath),
    (error: unknown) =>
      hasErrorCode(error, "EEXIST")
        ? Promise.reject(
            buildAlreadyExistsMessage({ newPath, oldPath }),
          )
        : moveFileThroughPlaceholder({ newPath, oldPath }),
  )

// Folders cannot be hard-linked. `rename` refuses to replace a folder
// that has anything in it (and refuses a file), so a folder rename can
// only ever replace an empty folder.
const moveIntoFreeName = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}) =>
  lstat(oldPath).then((stats) =>
    stats.isFile()
      ? moveFileIntoFreeName({ newPath, oldPath })
      : rename(oldPath, newPath),
  )

const claimTargetPath = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}) =>
  claimedTargetPaths.has(resolve(newPath))
    ? Promise.reject(
        buildAlreadyExistsMessage({ newPath, oldPath }),
      )
    : Promise.resolve(
        claimedTargetPaths.add(resolve(newPath)),
      ).then(() => undefined)

export const renameFileOrFolder = ({
  newPath,
  oldPath,
}: {
  newPath: string
  oldPath: string
}): Observable<void> =>
  defer(() =>
    claimTargetPath({ newPath, oldPath }).then(() =>
      isTargetAbsent(newPath)
        .then((isAbsent) =>
          isAbsent
            ? moveIntoFreeName({ newPath, oldPath })
            : Promise.reject(
                buildAlreadyExistsMessage({
                  newPath,
                  oldPath,
                }),
              ),
        )
        .finally(() => {
          claimedTargetPaths.delete(resolve(newPath))
        }),
    ),
  )

export const createRenameFileOrFolderObservable =
  ({
    fullPath: oldPath,
    sourcePath,
  }: {
    fullPath: string
    sourcePath: string
  }) =>
  (newName: string) =>
    of({
      oldPath,
      newPath: join(sourcePath, newName).concat(
        extname(oldPath),
      ),
    }).pipe(
      filter(({ newPath, oldPath }) => newPath !== oldPath),
      concatMap(({ newPath, oldPath }) =>
        renameFileOrFolder({
          newPath,
          oldPath,
        }).pipe(
          tap(() => {
            logInfo("RENAMED", oldPath, newPath)
          }),
          // Emit { oldPath, newPath } instead of void so callers
          // (renameDemos / renameMovieClipDownloads / nameAnimeEpisodes /
          // nameTvShowEpisodes — every command that streams renameFile
          // calls into job.results) get a useful per-rename record
          // instead of a chain of nulls.
          map(() => ({ newPath, oldPath })),
        ),
      ),
      logAndSwallowPipelineError(
        createRenameFileOrFolderObservable,
      ),
    )
