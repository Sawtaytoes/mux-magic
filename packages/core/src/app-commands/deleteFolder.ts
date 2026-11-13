import { stat } from "node:fs/promises"
import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { defer, map, type Observable } from "rxjs"

import { deletePath } from "../tools/deleteFiles.js"
import { validateWritablePath } from "../tools/pathSafety.js"

// Deletes the folder through the shared delete path, so it gets the
// same path check as the file explorer and honors DELETE_MODE: the
// folder goes to the trash unless the operator chose permanent deletes.
export const deleteFolder = ({
  isConfirmed,
  sourcePath,
}: {
  isConfirmed: boolean
  sourcePath: string
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
    // A missing folder fails the step, as `rm` did before: a cleanup
    // step that finds nothing usually means an earlier path is wrong.
    await stat(validateWritablePath(sourcePath))
    const result = await deletePath(sourcePath)
    return { path: sourcePath, mode: result.mode }
  }).pipe(
    map(({ mode, path }) => {
      logInfo(
        mode === "trash" ? "MOVED TO TRASH" : "DELETED",
        path,
      )
      return path
    }),
    logAndRethrowPipelineError(deleteFolder),
  )
