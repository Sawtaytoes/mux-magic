import { rename } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import {
  applyRenameRegex,
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  type RenameRegex,
  runTasks,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  from,
  Observable,
  of,
  toArray,
} from "rxjs"

export type RenameRecord = {
  source: string
  destination: string
}

type RenamePlan = {
  source: string
  destination: string
}

// Wraps the rename pipeline in an Observable whose teardown aborts an
// internal AbortController. Each per-file rename consults the signal
// before issuing `fs.rename`, so an unsubscribe (sequence cancel,
// parallel sibling fail-fast) stops further renames mid-batch instead
// of plowing through the remaining files. Same shape copyFiles uses.
export const renameFiles = ({
  fileFilterRegex,
  isRecursive = false,
  recursiveDepth = 0,
  renameRegex,
  sourcePath,
}: {
  fileFilterRegex?: string
  isRecursive?: boolean
  recursiveDepth?: number
  renameRegex: RenameRegex
  sourcePath: string
}): Observable<RenameRecord> =>
  new Observable<RenameRecord>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = getFilesAtDepth({
      depth: isRecursive ? recursiveDepth || 1 : 0,
      sourcePath,
    })
      .pipe(
        toArray(),
        concatMap((files) => {
          const matchedFiles =
            fileFilterRegex == null
              ? files
              : files.filter((file) =>
                  new RegExp(fileFilterRegex).test(
                    file.filename.concat(
                      extname(file.fullPath),
                    ),
                  ),
                )

          const plans: RenamePlan[] = matchedFiles
            .map((file) => {
              const oldName = file.filename.concat(
                extname(file.fullPath),
              )
              const newName = applyRenameRegex(
                oldName,
                renameRegex,
              )
              return {
                source: file.fullPath,
                destination: join(
                  dirname(file.fullPath),
                  newName,
                ),
              }
            })
            .filter(
              (plan) => plan.source !== plan.destination,
            )

          // Pre-flight: group targets by case-insensitive
          // path so a same-volume rename can't silently
          // overwrite a sibling on Windows (case-only
          // collision) or on POSIX (exact duplicate).
          const collisions = Array.from(
            plans
              .reduce((groups, plan) => {
                const key = plan.destination.toLowerCase()
                const existing = groups.get(key) ?? []
                return new Map(groups).set(
                  key,
                  existing.concat(plan),
                )
              }, new Map<string, RenamePlan[]>())
              .values(),
          ).filter((group) => group.length > 1)

          if (collisions.length > 0) {
            const message = collisions
              .map(
                (group) =>
                  `${group[0].destination}: ${group
                    .map((plan) => plan.source)
                    .join(", ")}`,
              )
              .join("\n")
            throw new Error(
              `renameFiles collision detected — refusing to rename. Targets:\n${message}`,
            )
          }

          matchedFiles
            .filter((file) => {
              const oldName = file.filename.concat(
                extname(file.fullPath),
              )
              return (
                applyRenameRegex(oldName, renameRegex) ===
                oldName
              )
            })
            .forEach((file) => {
              logInfo("NO-OP RENAME", file.fullPath)
            })

          if (plans.length === 0) {
            return from([] as RenameRecord[])
          }

          return from(plans).pipe(
            runTasks((plan) =>
              defer(async () => {
                if (abortController.signal.aborted) {
                  throw new Error(
                    "renameFiles aborted before rename",
                  )
                }
                await rename(plan.source, plan.destination)
                logInfo(
                  "RENAMED",
                  plan.source,
                  plan.destination,
                )
              }).pipe(
                concatMap(() =>
                  of({
                    source: plan.source,
                    destination: plan.destination,
                  } satisfies RenameRecord),
                ),
              ),
            ),
          )
        }),
        logAndRethrowPipelineError(renameFiles),
      )
      .subscribe(subscriber)

    return () => {
      // Order: abort first so any in-flight defer that
      // hasn't yet invoked fs.rename rejects via the
      // signal check; then unsubscribe to stop further
      // emissions.
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
