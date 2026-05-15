import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"

import {
  getLoggingContext,
  loggingContext,
} from "./context.js"
import type { Logger } from "./logger.js"

export const startSpan = async <T>(
  logger: Logger,
  name: string,
  fn: () => Promise<T> | T,
): Promise<T> => {
  const parentContext = getLoggingContext()
  const traceId = parentContext.traceId ?? randomUUID()
  const spanId = randomUUID()
  const startedAt = performance.now()

  logger.debug(`span enter: ${name}`, {
    traceId,
    spanId,
    spanName: name,
  })

  return loggingContext.run(
    { ...parentContext, traceId, spanId },
    async () => {
      try {
        const result = await fn()
        logger.debug(`span exit: ${name}`, {
          traceId,
          spanId,
          spanName: name,
          elapsedMs: performance.now() - startedAt,
        })
        return result
      } catch (error) {
        logger.error(`span error: ${name}`, {
          traceId,
          spanId,
          spanName: name,
          elapsedMs: performance.now() - startedAt,
          errorName:
            error instanceof Error ? error.name : "unknown",
        })
        throw error
      }
    },
  )
}
