import {
  catchError,
  type OperatorFunction,
  throwError,
} from "rxjs"
import { logError } from "./logMessage.js"

export const logPipelineError = <PipelineValue>(
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
