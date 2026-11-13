import { randomUUID } from "node:crypto"
import { rename, unlink } from "node:fs/promises"

import { hasErrorCode } from "./hasErrorCode.js"
import { logWarning } from "./logMessage.js"

// Windows can refuse a rename onto an existing file (EPERM or EACCES,
// for example on some network shares). Elsewhere `rename` replaces the
// destination in one atomic step.
const isWindowsReplaceRefusal = ({
  error,
  platform,
}: {
  error: unknown
  platform: NodeJS.Platform
}) =>
  platform === "win32" &&
  (hasErrorCode(error, "EPERM") ||
    hasErrorCode(error, "EACCES"))

// The old destination moves to a unique name first, so a failed rename
// can put it back. It is deleted only after the new file is in place.
// The random suffix keeps the set-aside name from landing on any other
// file.
const renameWithDestinationSetAside = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => {
  const setAsidePath = `${destinationPath}.muxmagic-replaced-${randomUUID()}`

  return rename(destinationPath, setAsidePath).then(() =>
    rename(sourcePath, destinationPath).then(
      () =>
        unlink(setAsidePath).catch((error: unknown) => {
          logWarning(
            "COULD NOT REMOVE REPLACED FILE",
            setAsidePath,
            String(error),
          )
        }),
      (renameError: unknown) =>
        rename(setAsidePath, destinationPath).then(() =>
          Promise.reject(renameError),
        ),
    ),
  )
}

/**
 * Renames `sourcePath` onto `destinationPath`, replacing an existing
 * destination without ever deleting it first. A failed rename leaves
 * the old destination in place. Only on Windows, and only after a plain
 * rename refused to replace the file, the old destination is renamed
 * aside and restored if the second rename fails.
 */
export const renameOntoDestination = ({
  destinationPath,
  hasExistingDestination,
  platform = process.platform,
  sourcePath,
}: {
  destinationPath: string
  hasExistingDestination: boolean
  platform?: NodeJS.Platform
  sourcePath: string
}): Promise<void> =>
  rename(sourcePath, destinationPath).catch(
    (error: unknown) =>
      hasExistingDestination &&
      isWindowsReplaceRefusal({ error, platform })
        ? renameWithDestinationSetAside({
            destinationPath,
            sourcePath,
          })
        : Promise.reject(error),
  )
