import type { PathLike } from "node:fs"
// eslint-disable-next-line no-restricted-imports -- this module is the one place core writes media through node:fs/promises; every wrapper below checks its paths first.
import * as fileSystem from "node:fs/promises"
import { fileURLToPath } from "node:url"
// eslint-disable-next-line no-restricted-imports -- the wrappers below are the only callers of these @mux-magic/tools write helpers in core.
import * as tools from "@mux-magic/tools"
import { defer, type Observable } from "rxjs"

import { assertWritePathInsideAllowedRoots } from "./pathSafety.js"

// Core's write primitives. Every app command, spawn operation, and
// music writer in core moves, renames, deletes, and writes media through
// these wrappers instead of `node:fs/promises` or the @mux-magic/tools
// helpers directly, so a path a command builds or finds while it runs
// (a parent folder it removes, a file reached through a symbolic link)
// gets the same allowed-roots check as the command's parameters.
//
// Each wrapper keeps the signature of the function it wraps. A refused
// path rejects the returned promise (or errors the observable) with a
// PathSafetyError before anything on disk changes. With no allowed roots
// (a source install with no ALLOWED_FILE_ROOTS) the check does nothing,
// so the CLI on a desktop behaves as before.
//
// The app's own state (job records, caches, the transcode temp store)
// lives outside the media roots and keeps writing through node:fs
// directly; ESLint lists those files.

// A path argument may be a string, a Buffer, or a file: URL. A
// FileHandle (writeFile accepts one) names no path, so it is skipped:
// opening it was the write that needed the check.
const toPathString = (path: unknown): string | null =>
  typeof path === "string"
    ? path
    : path instanceof URL
      ? fileURLToPath(path)
      : Buffer.isBuffer(path)
        ? path.toString()
        : null

// Throws a PathSafetyError when a path falls outside the allowed roots.
// `isLinkFollowed` is true for writes into a file's content and false for
// operations on the directory entry; see
// assertWritePathInsideAllowedRoots.
export const assertWritablePaths = ({
  isLinkFollowed,
  paths,
}: {
  isLinkFollowed: boolean
  paths: ReadonlyArray<unknown>
}): void => {
  paths
    .map(toPathString)
    .filter((path) => path !== null)
    .forEach((path) => {
      assertWritePathInsideAllowedRoots({
        isLinkFollowed,
        path,
      })
    })
}

// Runs the check, then the action. A refusal becomes a rejected promise
// rather than a synchronous throw, so callers that chain `.catch` or
// wrap the call in `from(...)` see it the same way as an fs error.
const checkThenRun = <Result>({
  action,
  isLinkFollowed,
  paths,
}: {
  action: () => Promise<Result>
  isLinkFollowed: boolean
  paths: ReadonlyArray<unknown>
}): Promise<Result> =>
  new Promise<void>((resolvePromise) => {
    assertWritablePaths({ isLinkFollowed, paths })
    resolvePromise()
  }).then(action)

export const mkdir = ((
  path: PathLike,
  ...rest: unknown[]
) =>
  checkThenRun({
    action: () =>
      (
        fileSystem.mkdir as (
          ...args: unknown[]
        ) => Promise<unknown>
      )(path, ...rest),
    isLinkFollowed: false,
    paths: [path],
  })) as typeof fileSystem.mkdir

export const rename: typeof fileSystem.rename = (
  oldPath,
  newPath,
) =>
  checkThenRun({
    action: () => fileSystem.rename(oldPath, newPath),
    isLinkFollowed: false,
    paths: [oldPath, newPath],
  })

export const rm: typeof fileSystem.rm = (path, options) =>
  checkThenRun({
    action: () => fileSystem.rm(path, options),
    isLinkFollowed: false,
    paths: [path],
  })

export const rmdir: typeof fileSystem.rmdir = (path) =>
  checkThenRun({
    action: () => fileSystem.rmdir(path),
    isLinkFollowed: false,
    paths: [path],
  })

export const unlink: typeof fileSystem.unlink = (path) =>
  checkThenRun({
    action: () => fileSystem.unlink(path),
    isLinkFollowed: false,
    paths: [path],
  })

export const utimes: typeof fileSystem.utimes = (
  path,
  accessTime,
  modifiedTime,
) =>
  checkThenRun({
    action: () =>
      fileSystem.utimes(path, accessTime, modifiedTime),
    isLinkFollowed: true,
    paths: [path],
  })

export const writeFile: typeof fileSystem.writeFile = (
  file,
  data,
  options,
) =>
  checkThenRun({
    action: () => fileSystem.writeFile(file, data, options),
    isLinkFollowed: true,
    paths: [file],
  })

export const aclSafeCopyFile: typeof tools.aclSafeCopyFile =
  (source, destination, options) =>
    checkThenRun({
      action: () =>
        tools.aclSafeCopyFile(source, destination, options),
      isLinkFollowed: true,
      paths: [destination],
    })

// The check covers the destination folder. A file the copy creates
// inside it lands under that folder, so it stays inside the same root
// unless the destination already holds a symbolic link to elsewhere.
export const aclSafeCopyFolder: typeof tools.aclSafeCopyFolder =
  (source, destination, options) =>
    checkThenRun({
      action: () =>
        tools.aclSafeCopyFolder(
          source,
          destination,
          options,
        ),
      isLinkFollowed: true,
      paths: [destination],
    })

export const renameOntoDestination: typeof tools.renameOntoDestination =
  (renameRequest) =>
    checkThenRun({
      action: () =>
        tools.renameOntoDestination(renameRequest),
      isLinkFollowed: false,
      paths: [
        renameRequest.sourcePath,
        renameRequest.destinationPath,
      ],
    })

export const makeDirectory = (
  directoryPath: string,
): Observable<string> =>
  defer(() => {
    assertWritablePaths({
      isLinkFollowed: false,
      paths: [directoryPath],
    })
    return tools.makeDirectory(directoryPath)
  })

export const renameFileOrFolder = (renameRequest: {
  newPath: string
  oldPath: string
}): Observable<void> =>
  defer(() => {
    assertWritablePaths({
      isLinkFollowed: false,
      paths: [renameRequest.oldPath, renameRequest.newPath],
    })
    return tools.renameFileOrFolder(renameRequest)
  })
