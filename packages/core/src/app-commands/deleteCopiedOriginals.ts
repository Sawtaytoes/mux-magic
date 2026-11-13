import type { Stats } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  EMPTY,
  filter,
  from,
  map,
  tap,
} from "rxjs"

import { deletePath } from "../tools/deleteFiles.js"
import { hasErrorCode } from "../tools/moveSingleFile.js"

// Deletes each path in `pathsToDelete`. Intended as the last step of a
// copy-then-cleanup sequence: a prior `copyFiles` step outputs
// `copiedSourcePaths` and `copiedDestinationPaths` via `extractOutputs`,
// which a downstream sequence step pipes into this command via
// `linkedTo`. Emits the deleted path string for each entry so the job
// log shows what was removed.
//
// The two lists pair up by position: `copiedDestinationPaths[index]` is
// the copy of `pathsToDelete[index]`. Before anything is deleted, every
// original is checked against its copy: the copy must exist, a file must
// have the same size, and a folder's copy must hold a same-size copy of
// every file inside it. If any check fails, nothing is deleted and the
// step fails with the list of problems.
//
// Is a no-op (emits nothing, completes immediately) when `pathsToDelete`
// is empty — this covers the case where a prior copy step matched zero
// files, so there is nothing to clean up. An original that is already
// gone (for example after `moveFiles`) is skipped.
//
// Deletes go through the shared delete path, which validates each path
// and honors DELETE_MODE (trash by default).

const getStatsOrNull = (path: string) =>
  stat(path).catch((error: unknown) =>
    hasErrorCode(error, "ENOENT")
      ? null
      : Promise.reject(error),
  )

const compareFolderEntries = ({
  copyPath,
  originalPath,
}: {
  copyPath: string
  originalPath: string
}): Promise<string[]> =>
  readdir(originalPath).then((entryNames) =>
    Promise.all(
      entryNames.map((entryName) =>
        findCopyProblems({
          copyPath: join(copyPath, entryName),
          originalPath: join(originalPath, entryName),
        }),
      ),
    ).then((problemLists) => problemLists.flat()),
  )

const compareStats = ({
  copyPath,
  copyStats,
  originalPath,
  originalStats,
}: {
  copyPath: string
  copyStats: Stats | null
  originalPath: string
  originalStats: Stats | null
}): Promise<string[]> =>
  originalStats === null
    ? Promise.resolve([])
    : copyStats === null
      ? Promise.resolve([
          `The copy of "${originalPath}" is missing at "${copyPath}".`,
        ])
      : originalStats.isDirectory()
        ? copyStats.isDirectory()
          ? compareFolderEntries({ copyPath, originalPath })
          : Promise.resolve([
              `The copy of folder "${originalPath}" at "${copyPath}" is not a folder.`,
            ])
        : copyStats.isFile() &&
            copyStats.size === originalStats.size
          ? Promise.resolve([])
          : Promise.resolve([
              `The copy of "${originalPath}" at "${copyPath}" does not match its size.`,
            ])

const findCopyProblems = ({
  copyPath,
  originalPath,
}: {
  copyPath: string
  originalPath: string
}): Promise<string[]> =>
  !isAbsolute(originalPath) || !isAbsolute(copyPath)
    ? Promise.resolve([
        `Both paths must be absolute: "${originalPath}" and "${copyPath}".`,
      ])
    : resolve(copyPath) === resolve(originalPath)
      ? Promise.resolve([
          `The copy of "${originalPath}" is the same path as the original.`,
        ])
      : Promise.all([
          getStatsOrNull(originalPath),
          getStatsOrNull(copyPath),
        ]).then(([originalStats, copyStats]) =>
          compareStats({
            copyPath,
            copyStats,
            originalPath,
            originalStats,
          }),
        )

const findAllCopyProblems = ({
  copiedDestinationPaths,
  pathsToDelete,
}: {
  copiedDestinationPaths: string[]
  pathsToDelete: string[]
}) =>
  copiedDestinationPaths.length === pathsToDelete.length
    ? Promise.all(
        pathsToDelete.map((originalPath, index) =>
          findCopyProblems({
            copyPath: copiedDestinationPaths[index],
            originalPath,
          }),
        ),
      ).then((problemLists) => problemLists.flat())
    : Promise.resolve([
        `Got ${pathsToDelete.length} paths to delete but ${copiedDestinationPaths.length} copied destination paths. Link copiedDestinationPaths from the same copy step as pathsToDelete.`,
      ])

const assertCopiesExist = ({
  copiedDestinationPaths,
  pathsToDelete,
}: {
  copiedDestinationPaths: string[]
  pathsToDelete: string[]
}) =>
  findAllCopyProblems({
    copiedDestinationPaths,
    pathsToDelete,
  }).then((problems) =>
    problems.length === 0
      ? pathsToDelete
      : Promise.reject(
          new Error(
            [
              "Refusing to delete any original, because not every copy was confirmed:",
            ]
              .concat(problems)
              .join("\n"),
          ),
        ),
  )

const deleteOriginal = (pathToDelete: string) =>
  defer(() => getStatsOrNull(pathToDelete)).pipe(
    tap((stats) => {
      if (stats === null) {
        logInfo("ALREADY GONE", pathToDelete)
      }
    }),
    filter((stats) => stats !== null),
    concatMap(() => deletePath(pathToDelete)),
    tap((result) => {
      logInfo(
        result.mode === "trash"
          ? "MOVED TO TRASH"
          : "DELETED",
        pathToDelete,
      )
    }),
    map(() => pathToDelete),
  )

export const deleteCopiedOriginals = ({
  copiedDestinationPaths = [],
  pathsToDelete,
}: {
  copiedDestinationPaths?: string[]
  pathsToDelete: string[]
}) =>
  (pathsToDelete.length === 0
    ? EMPTY
    : defer(() =>
        assertCopiesExist({
          copiedDestinationPaths,
          pathsToDelete,
        }),
      ).pipe(
        concatMap((confirmedPaths) => from(confirmedPaths)),
        concatMap(deleteOriginal),
      )
  ).pipe(logAndRethrowPipelineError(deleteCopiedOriginals))
