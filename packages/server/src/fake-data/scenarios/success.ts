import { Observable } from "rxjs"

import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"
import { logInfo } from "../../tools/logMessage.js"

// Default total runtime for the success scenario. Slightly longer than
// `failure` / `inProgress` so success is the visible "happy path" while
// the others demonstrate edge cases without dragging the smoke test out.
const DEFAULT_TOTAL_MS = 4000
const STEPS = 8

// Builds an observable that:
//   - logs a startup line synchronously,
//   - emits a few canned ProgressEvents over `totalMs` (directly via
//     emitJobEvent so the throttle window in progressEmitter doesn't
//     swallow events on a fast 4s run),
//   - emits a single result value, then completes.
//
// Cancellation is honored — the teardown returned from the Observable
// factory clears the timer when a subscriber unsubscribes. RxJS does NOT
// fire `complete` on external unsubscribe, which lines up with how the
// real commands behave (see jobRunner / sequenceRunner cancel paths).
export const successScenario = (
  body: unknown,
  options: { totalMs?: number; label?: string } = {},
): Observable<unknown> =>
  new Observable<unknown>((subscriber) => {
    const totalMs = options.totalMs ?? DEFAULT_TOTAL_MS
    const label = options.label ?? "fake-success"
    const stepInterval = Math.max(
      50,
      Math.floor(totalMs / STEPS),
    )

    logInfo(label, "Starting fake successful run.")
    logInfo(label, `Body: ${JSON.stringify(body)}`)

    const jobId = getActiveJobId()
    let stepIndex = 0
    const timer = setInterval(() => {
      stepIndex += 1
      const ratio = stepIndex / STEPS

      if (jobId) {
        emitJobEvent(jobId, {
          type: "progress",
          ratio,
          filesDone: stepIndex,
          filesTotal: STEPS,
          currentFiles: [
            { path: "/fake/path/to/file.mkv", ratio },
          ],
        })
      }

      logInfo(
        label,
        `Step ${stepIndex}/${STEPS} processed.`,
      )

      if (stepIndex >= STEPS) {
        clearInterval(timer)
        logInfo(label, "Completed fake successful run.")
        subscriber.next({ ok: true, processedSteps: STEPS })
        subscriber.complete()
      }
    }, stepInterval)

    return () => {
      clearInterval(timer)
    }
  })
