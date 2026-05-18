import type { SSEStreamingApi } from "hono/streaming"

// Default cadence for the keepalive comment writer. Most idle drop
// thresholds (browser tab, OS, common reverse proxies) are ≥30s, so
// 20s comfortably stays under the floor while not adding meaningful
// CPU/network overhead.
const DEFAULT_KEEPALIVE_INTERVAL_MS = 20_000

// Hono's `streamSSE` doesn't send periodic keep-alives, so an SSE
// connection that has no real events to deliver can be silently dropped
// by the OS / browser tab idle / any intermediary after ~30s. The
// browser's EventSource then fires `onerror`, auto-reconnects after a
// short delay, and the user sees a "connection lost" flash for a
// connection that was supposed to stay open.
//
// Calling `startSseKeepalive(stream)` writes a `: keepalive\n\n` SSE
// comment line every interval — clients ignore comments, but the bytes
// reset every idle timer in the chain. The returned cleanup function
// MUST be registered on the stream's `onAbort` so the timer doesn't
// keep firing into a closed stream after the client disconnects.
export const startSseKeepalive = (
  stream: SSEStreamingApi,
  intervalMs: number = DEFAULT_KEEPALIVE_INTERVAL_MS,
): (() => void) => {
  const timer = setInterval(() => {
    if (stream.closed || stream.aborted) {
      clearInterval(timer)
      return
    }
    // SSE comment lines start with ":". Clients silently ignore them;
    // they exist purely as a heartbeat to keep the byte stream alive.
    stream.write(": keepalive\n\n").catch(() => {
      clearInterval(timer)
    })
  }, intervalMs)

  return () => {
    clearInterval(timer)
  }
}
