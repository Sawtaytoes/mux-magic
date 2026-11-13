/**
 * The part of Hono's `SSEStreamingApi` the keepalive uses. Declared here
 * so this package does not depend on Hono.
 */
export type SseKeepaliveStream = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Hono's SSEStreamingApi spells it this way
  aborted: boolean
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Hono's SSEStreamingApi spells it this way
  closed: boolean
  write: (input: string) => Promise<unknown>
}

/**
 * Default cadence for the keepalive comment. Most idle drop thresholds
 * (browser tab, OS, common reverse proxies) are at least 30 seconds, so 20
 * seconds stays under the floor without meaningful overhead.
 */
export const defaultSseKeepaliveIntervalMilliseconds = 20_000

/**
 * Write a `: keepalive` SSE comment every interval.
 *
 * Hono's `streamSSE` sends no periodic keepalive, so an SSE connection
 * with no real events can be dropped silently by the OS, an idle browser
 * tab, or any intermediary after about 30 seconds. The browser's
 * EventSource then reconnects, and the user sees a "connection lost" flash
 * for a connection that was supposed to stay open. Clients ignore comment
 * lines, but the bytes reset every idle timer in the chain.
 *
 * Register the returned cleanup function on the stream's `onAbort`, so the
 * timer does not keep firing into a closed stream.
 */
export const startSseKeepalive = ({
  intervalMilliseconds = defaultSseKeepaliveIntervalMilliseconds,
  stream,
}: {
  intervalMilliseconds?: number
  stream: SseKeepaliveStream
}): (() => void) => {
  const timer = setInterval(() => {
    if (stream.closed || stream.aborted) {
      clearInterval(timer)
    } else {
      stream.write(": keepalive\n\n").catch(() => {
        clearInterval(timer)
      })
    }
  }, intervalMilliseconds)

  return () => {
    clearInterval(timer)
  }
}
