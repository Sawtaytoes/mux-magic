import {
  catchError,
  EMPTY,
  OperatorFunction,
} from "rxjs"
import { logError } from "./logMessage.js"

// Logs the error under `func`'s name (or the provided string label) and
// completes the observable with no emissions. Use this in INNER pipes —
// per-file `mergeMap`/`concatMap` callbacks where one bad item shouldn't
// abort the rest of the batch (e.g. spawn-op wrappers, per-file fetch
// helpers). For OUTER terminal pipes that need the error to reach the
// runner, use `logAndRethrow` instead.
export const logAndSwallow = <
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

    return EMPTY
  })
)
