import { readdir, stat } from "node:fs/promises"
import { logInfo } from "@mux-magic/tools"
import { defer, type Observable } from "rxjs"

// Sentinel emitted by `exitIfEmpty`. The runner's `extractOutputs`
// projector lifts these fields onto the child job's `outputs` map; the
// item loop in `sequenceRunner` then inspects `outputs.isExiting` to
// decide whether to short-circuit the umbrella job with `status:
// "exited"`. Both fields are part of the reserved-key contract — any
// future flow-control command (`exitIfFileCountBelow`, `exitIf`, …) that
// wants the same behaviour just needs to publish them too; the runner
// has no per-command knowledge.
export type ExitDecision = {
  isExiting: boolean
  exitReason: string
}

const ENOENT = "ENOENT"

const isEnoent = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === ENOENT

// Returns an Observable that emits exactly one ExitDecision describing
// whether the sequence should exit at this step. "Empty" covers two
// cases the user practically can't distinguish from each other:
//   1. `sourcePath` does not exist — `readdir` rejects with ENOENT.
//   2. `sourcePath` exists but contains zero entries.
// Both mean "the next step has nothing to chew on" — the runner treats
// the umbrella + every later flat step as `exited`. Any other error
// (EACCES, ENOTDIR — the path points at a file, etc.) is genuine and
// rethrows so the step fails the sequence the normal way.
export const exitIfEmpty = ({
  sourcePath,
}: {
  sourcePath: string
}): Observable<ExitDecision> =>
  defer(async (): Promise<ExitDecision> => {
    try {
      const stats = await stat(sourcePath)
      if (!stats.isDirectory()) {
        // ENOTDIR-equivalent: caller pointed at a file. Treat as a
        // legitimate failure rather than an exit — they almost
        // certainly meant the file's parent and we should not paper
        // over the mistake.
        throw new Error(
          `exitIfEmpty: sourcePath "${sourcePath}" is not a directory`,
        )
      }
      const entries = await readdir(sourcePath)
      if (entries.length === 0) {
        logInfo(
          "EXIT-IF-EMPTY",
          `${sourcePath} is empty — sequence will exit.`,
        )
        return {
          isExiting: true,
          exitReason: `sourcePath "${sourcePath}" is empty`,
        }
      }
      logInfo(
        "EXIT-IF-EMPTY",
        `${sourcePath} contains ${entries.length} entr${entries.length === 1 ? "y" : "ies"} — sequence continues.`,
      )
      return { isExiting: false, exitReason: "" }
    } catch (error) {
      if (isEnoent(error)) {
        logInfo(
          "EXIT-IF-EMPTY",
          `${sourcePath} does not exist — sequence will exit.`,
        )
        return {
          isExiting: true,
          exitReason: `sourcePath "${sourcePath}" does not exist`,
        }
      }
      throw error
    }
  })
