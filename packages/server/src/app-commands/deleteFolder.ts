import { rm } from "node:fs/promises"
import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { defer, map, type Observable } from "rxjs"

export const deleteFolder = ({
  isConfirmed,
  folderPath,
}: {
  isConfirmed: boolean
  folderPath: string
}): Observable<string> =>
  defer(async () => {
    // Safety guard: refuse to run unless the caller explicitly opted in.
    // The Zod schema also enforces isConfirmed: true at the API boundary, but
    // this layer protects CLI / direct callers too.
    if (isConfirmed !== true) {
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
    logAndRethrowPipelineError(deleteFolder),
  )
