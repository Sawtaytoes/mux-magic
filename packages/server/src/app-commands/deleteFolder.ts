import { rm } from "node:fs/promises"
import { defer, map, type Observable } from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"

export const deleteFolder = ({
  confirm,
  folderPath,
}: {
  confirm: boolean
  folderPath: string
}): Observable<string> =>
  defer(async () => {
    // Safety guard: refuse to run unless the caller explicitly opted in.
    // The Zod schema also enforces confirm: true at the API boundary, but
    // this layer protects CLI / direct callers too.
    if (confirm !== true) {
      throw new Error(
        "deleteFolder refused — pass confirm: true (or --confirm on the CLI) to acknowledge this will recursively delete a directory.",
      )
    }
    await rm(folderPath, { recursive: true })
    return folderPath
  }).pipe(
    map((path) => {
      logInfo("DELETED", path)
      return path
    }),
    logAndRethrow(deleteFolder),
  )
