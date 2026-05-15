import { AsyncLocalStorage } from "node:async_hooks"

export type LoggerContext = {
  jobId?: string
  stepIndex?: number
  fileId?: string
  traceId?: string
  spanId?: string
}

export const loggingContext =
  new AsyncLocalStorage<LoggerContext>()

export const getLoggingContext = (): LoggerContext =>
  loggingContext.getStore() ?? {}

export const withLoggingContext = <T>(
  bindings: LoggerContext,
  fn: () => T,
): T => {
  const merged = { ...getLoggingContext(), ...bindings }
  return loggingContext.run(merged, fn)
}
