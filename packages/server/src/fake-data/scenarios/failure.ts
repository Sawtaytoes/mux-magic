import { logError, logInfo } from "@mux-magic/tools"
import { Observable } from "rxjs"
import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"

// Total runtime before the scripted error fires. Short on purpose — the
// failure scenario is mostly there so the UI's red-state styling and the
// sequence runner's fail-fast cascade have something to chew on.
const DEFAULT_TOTAL_MS = 2500
const STEPS_BEFORE_FAIL = 3

// Emits a few progress events, then errors out with a canned message.
// Useful for exercising:
//   - parallel-group fail-fast (other siblings get cancelled)
//   - serial-group propagation (subsequent items get marked skipped)
//   - the Jobs UI's failed-state styling and `error` field
export const failureScenario = (
  body: unknown,
  options: {
    totalMs?: number
    label?: string
    errorMessage?: string
  } = {},
): Observable<unknown> =>
  new Observable<unknown>((subscriber) => {
    const totalMs = options.totalMs ?? DEFAULT_TOTAL_MS
    const label = options.label ?? "fake-failure"
    const message =
      options.errorMessage ??
      "Fake failure: pretending the underlying tool exited non-zero."
    const stepInterval = Math.max(
      50,
      Math.floor(totalMs / (STEPS_BEFORE_FAIL + 1)),
    )

    logInfo(label, "Starting fake failing run.")
    logInfo(label, `Body: ${JSON.stringify(body)}`)

    const jobId = getActiveJobId()
    let stepIndex = 0
    const timer = setInterval(() => {
      stepIndex += 1

      if (stepIndex <= STEPS_BEFORE_FAIL) {
        const ratio = stepIndex / (STEPS_BEFORE_FAIL + 1)
        if (jobId) {
          emitJobEvent(jobId, {
            type: "progress",
            ratio,
            filesDone: stepIndex,
            filesTotal: STEPS_BEFORE_FAIL + 1,
            currentFiles: [
              { path: "/fake/path/to/broken.mkv", ratio },
            ],
          })
        }
        logInfo(
          label,
          `Step ${stepIndex}/${STEPS_BEFORE_FAIL + 1} processed.`,
        )
        return
      }

      // Past the threshold — fire the scripted failure.
      clearInterval(timer)
      logError(label, message)
      subscriber.error(new Error(message))
    }, stepInterval)

    return () => {
      clearInterval(timer)
    }
  })
