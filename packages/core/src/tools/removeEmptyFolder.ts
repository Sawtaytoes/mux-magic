import { readdir } from "node:fs/promises"
import { logWarning } from "@mux-magic/tools"
import { rmdir } from "./guardedFileWrites.js"
import { hasErrorCode } from "./moveSingleFile.js"

export type RemoveEmptyFolderResult = "removed" | "kept"

const isNotEmptyError = (error: unknown) =>
  hasErrorCode(error, "ENOTEMPTY") ||
  hasErrorCode(error, "EEXIST")

const reportKeptFolder = (folderPath: string) =>
  readdir(folderPath).then((entryNames) => {
    logWarning(
      "KEPT FOLDER, NOT EMPTY",
      folderPath,
      entryNames.join(", "),
    )
  })

// Removes a folder only when nothing is left in it. `rmdir` refuses a
// folder that still has entries, so a nested subfolder or a file that
// was not moved can never be deleted here. A folder that is not empty
// stays where it is, and its leftover entries are logged.
export const removeEmptyFolder = (
  folderPath: string,
): Promise<RemoveEmptyFolderResult> =>
  rmdir(folderPath).then(
    () => "removed" as const,
    (error: unknown) =>
      isNotEmptyError(error)
        ? reportKeptFolder(folderPath).then(
            () => "kept" as const,
          )
        : Promise.reject(error),
  )
