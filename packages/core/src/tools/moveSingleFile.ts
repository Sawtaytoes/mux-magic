import { rename, stat, unlink } from "node:fs/promises"
import {
  aclSafeCopyFile,
  type CopyOptions,
  logWarning,
} from "@mux-magic/tools"

import { getPlatform } from "./currentEnvironment.js"

// A move is `fs.rename` — no temp file, no byte copy on the same
// volume. Extracted from moveFiles so every command that moves a file
// shares ONE implementation; see
// docs/decisions/2026-05-19-atomic-copy-and-filesystem-move.md
// ("Do not route a same-volume move through the copy path").

export const hasErrorCode = (
  error: unknown,
  code: string,
) =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === code

export const buildExistsError = (
  destination: string,
): Error & { code: string } => {
  const error = new Error(
    `Refusing to overwrite existing destination: ${destination}`,
  ) as Error & { code: string }
  error.code = "EEXIST"
  return error
}

export const checkDestination = async (
  destination: string,
  isOverwriteAllowed: boolean,
) => {
  try {
    await stat(destination)
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false
    throw error
  }
  if (!isOverwriteAllowed)
    throw buildExistsError(destination)
  return true
}

// Windows can refuse a rename onto an existing file (EPERM or EACCES,
// for example on some network shares). Only there, and only after the
// plain rename failed, the old destination is first renamed aside, so a
// failed rename can put it back. It is deleted only after the new file
// is in place. Everywhere else `rename` replaces the destination in one
// atomic step, and nothing is deleted first.
const isWindowsReplaceRefusal = (error: unknown) =>
  getPlatform() === "win32" &&
  (hasErrorCode(error, "EPERM") ||
    hasErrorCode(error, "EACCES"))

const getSetAsidePath = (destinationPath: string) =>
  `${destinationPath}.muxmagic-replaced`

const renameWithDestinationSetAside = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) =>
  rename(
    destinationPath,
    getSetAsidePath(destinationPath),
  ).then(() =>
    rename(sourcePath, destinationPath).then(
      () =>
        unlink(getSetAsidePath(destinationPath)).catch(
          (error: unknown) => {
            logWarning(
              "COULD NOT REMOVE REPLACED FILE",
              getSetAsidePath(destinationPath),
              String(error),
            )
          },
        ),
      (renameError: unknown) =>
        rename(
          getSetAsidePath(destinationPath),
          destinationPath,
        ).then(() => Promise.reject(renameError)),
    ),
  )

const renameOntoDestination = ({
  destinationPath,
  hasExistingDestination,
  sourcePath,
}: {
  destinationPath: string
  hasExistingDestination: boolean
  sourcePath: string
}) =>
  rename(sourcePath, destinationPath).catch(
    (error: unknown) =>
      hasExistingDestination &&
      isWindowsReplaceRefusal(error)
        ? renameWithDestinationSetAside({
            destinationPath,
            sourcePath,
          })
        : Promise.reject(error),
  )

// Same-volume rename short-circuit: metadata-only O(1) move. EXDEV
// (cross-volume) triggers the streaming-copy fallback, which retains
// per-byte progress and the AbortController wiring.
export const moveSingleFile = async ({
  copyOptions,
  destinationPath,
  isOverwriteAllowed,
  sourcePath,
}: {
  copyOptions: CopyOptions
  destinationPath: string
  isOverwriteAllowed: boolean
  sourcePath: string
}): Promise<"renamed" | "copied"> => {
  const hasExistingDestination = await checkDestination(
    destinationPath,
    isOverwriteAllowed,
  )
  try {
    await renameOntoDestination({
      destinationPath,
      hasExistingDestination,
      sourcePath,
    })
    return "renamed"
  } catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error
    // Cross-volume: stream the bytes, then drop the source entry.
    // aclSafeCopyFile copies to a temp file and renames it into place,
    // so an existing destination survives until the copy is complete.
    // isOverwriteAllowed passes through so it doesn't re-trip on the
    // same destination check we just made.
    await aclSafeCopyFile(sourcePath, destinationPath, {
      ...copyOptions,
      isOverwriteAllowed: true,
    })
    await unlink(sourcePath)
    return "copied"
  }
}
