import { map, type OperatorFunction } from "rxjs"

export class NoopError extends Error {
  constructor() {
    super("No items were processed")
    this.name = "NoopError"
  }
}

// Place AFTER logAndRethrow so the NoopError bypasses logAndRethrow's
// catchError and reaches jobRunner directly without being logged as a
// real error. jobRunner catches NoopError and sets status → "noop".
export const noopIfEmpty = <T>(): OperatorFunction<T[], T[]> =>
  map((results) => {
    if (results.length === 0) throw new NoopError()
    return results
  })
