import { rm } from "node:fs/promises"
import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, defer, EMPTY, from, map } from "rxjs"

// Deletes each path in `sourcePaths`. Intended as the last step of a
// copy-then-cleanup sequence: a prior `copyFiles` step outputs
// `copiedSourcePaths` via `extractOutputs`, which a downstream sequence
// step pipes into this command via `linkedTo`. Emits the deleted path
// string for each entry so the job log shows what was removed.
//
// Is a no-op (emits nothing, completes immediately) when `sourcePaths`
// is empty — this covers the case where a prior copy step matched zero
// files, so there is nothing to clean up.
//
// Each entry is removed with `{ recursive: true }` so both files and
// directories are handled uniformly; passing a plain file path works
// because Node's `rm` accepts files when `recursive` is set.
export const deleteCopiedOriginals = ({
  sourcePaths,
}: {
  sourcePaths: string[]
}) =>
  (sourcePaths.length === 0
    ? EMPTY
    : from(sourcePaths)
  ).pipe(
    concatMap((sourcePath) =>
      defer(() =>
        rm(sourcePath, { recursive: true, force: true }),
      ).pipe(
        map(() => {
          logInfo("DELETED", sourcePath)
          return sourcePath
        }),
      ),
    ),
    logAndRethrowPipelineError(deleteCopiedOriginals),
  )
