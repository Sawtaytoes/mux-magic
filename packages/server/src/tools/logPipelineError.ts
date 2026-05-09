import {
  catchError,
  OperatorFunction,
  throwError,
} from "rxjs"
import { logError } from "./logMessage.js"

export const logPipelineError = <
  PipelineValue
>(
  func: (
    | Function
    | string
  ),
): (
  OperatorFunction<
    PipelineValue,
    PipelineValue
  >
) => (
  catchError((
    error,
  ) => {
    logError(
      (
        (
          typeof func
          === "function"
        )
        ? (
          func
          .name
        )
        : func
      ),
      (
        (
          (
            Buffer
            .isBuffer(
              error
            )
          )
        )
        ? (
          error
          .toString(
            "utf8"
          )
        )
        : error
      ),
    )

    return (
      throwError(() => (
        error
      ))
    )
  })
)
