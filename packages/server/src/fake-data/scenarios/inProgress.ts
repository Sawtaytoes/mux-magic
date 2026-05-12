import { Observable } from "rxjs"

import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"
import { logInfo } from "../../tools/logMessage.js"

// "Stays running" scenario — emits progress every interval forever (or
// until the subscriber unsubscribes / the job is cancelled). Lets the
// UI exercise the indeterminate-progress / cancel-while-running paths
// without waiting for a real long-running ffmpeg pass.
const TICK_MS = 800

export const inProgressScenario = (
  body: unknown,
  options: { tickMs?: number; label?: string } = {},
): Observable<unknown> =>
  new Observable<unknown>((_subscriber) => {
    const tickMs = options.tickMs ?? TICK_MS
    const label = options.label ?? "fake-in-progress"

    logInfo(
      label,
      "Starting fake long-running job (cancel to terminate).",
    )
    logInfo(label, `Body: ${JSON.stringify(body)}`)

    const jobId = getActiveJobId()
    let tick = 0
    const timer = setInterval(() => {
      tick += 1
      // Slow saw-tooth ratio that resets every 10 ticks — "we're working
      // on something but never quite done." Keeps the UI's progress bar
      // visibly animated without ever hitting 100%.
      const ratio = (tick % 10) / 10

      if (jobId) {
        emitJobEvent(jobId, {
          type: "progress",
          ratio,
          currentFiles: [
            {
              path: `/fake/path/to/in-flight-${tick}.mkv`,
              ratio,
            },
          ],
        })
      }

      logInfo(label, `Tick ${tick}: still working...`)
    }, tickMs)

    return () => {
      clearInterval(timer)
    }
  })
