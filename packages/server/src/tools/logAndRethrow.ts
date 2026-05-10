import {
  catchError,
  type OperatorFunction,
  throwError,
} from "rxjs"
import { logError } from "./logMessage.js"

// Logs the error under `func`'s name (or the provided string label) and
// re-emits it as an observable error so the downstream catchError handlers
// in jobRunner / sequenceRunner can flip the job's status to "failed".
// Use this at the OUTER terminal pipe of an app-command. For INNER pipes
// that should skip a broken item and continue the batch, use
// `logAndSwallow` instead.
export const logAndRethrow = <PipelineValue>(
  func: { name: string } | string,
): OperatorFunction<PipelineValue, PipelineValue> =>
  catchError((error) => {
    logError(
      typeof func === "string" ? func : func.name,
      Buffer.isBuffer(error)
        ? error.toString("utf8")
        : error,
    )

    return throwError(() => error)
  })
