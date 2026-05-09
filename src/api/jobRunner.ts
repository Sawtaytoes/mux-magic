import { EMPTY, type Observable } from "rxjs"
import { catchError } from "rxjs"

import {
  completeSubject,
  createSubject,
  getJob,
  registerJobSubscription,
  unregisterJobSubscription,
  updateJob,
} from "./jobStore.js"
import { withJobContext } from "./logCapture.js"
import type { Job } from "./types.js"

// Resolves with the final Job snapshot once the underlying observable
// reaches a terminal state — `completed`, `failed`, or `cancelled`. The
// `/commands/<name>` route ignores the returned promise (fire-and-forget,
// 202 returned to the client immediately). The sequence runner awaits it
// to drive its step-by-step loop without juggling jobEvents$ filtering.
export const runJob = (
  jobId: string,
  observable: Observable<unknown>,
  options: {
    // Optional projector that turns the collected emission stream into a
    // named-outputs object once the observable completes successfully.
    // The result is stored on the job's `outputs` field and surfaced in
    // the SSE done event so downstream sequence steps can reference it.
    extractOutputs?: (results: unknown[]) => Record<string, unknown>,
  } = {},
): Promise<Job | undefined> => {
  createSubject(jobId)

  updateJob(jobId, {
    startedAt: new Date(),
    status: "running",
  })

  return new Promise<Job | undefined>((resolve) => {
    // Run the observable inside the job's async context so all console.*
    // calls from the pipeline are routed to this job's log stream.
    withJobContext(jobId, () => {
      const subscription = (
        observable
        .pipe(
          catchError((err) => {
            // Don't clobber a "cancelled" status — cancelJob already wrote
            // the terminal state and the upstream error here is just
            // fallout from unsubscribe tearing the chain down.
            if (getJob(jobId)?.status === "cancelled") return EMPTY

            updateJob(jobId, {
              completedAt: new Date(),
              error: String(err),
              status: "failed",
            })

            return EMPTY
          }),
        )
        .subscribe({
          next: (value) => {
            const job = getJob(jobId)

            if (!job) return

            console.log(`[emission/${job.commandName}]`, JSON.stringify(value))

            updateJob(jobId, {
              results: (
                job
                .results
                .concat(value)
              ),
            })
          },
          complete: () => {
            const job = getJob(jobId)

            // Same guard as above — preserve the terminal status set by
            // cancelJob even if the inner pipeline races to complete first.
            if (job?.status === "cancelled") {
              unregisterJobSubscription(jobId)
              return
            }

            if (job?.status !== "failed") {
              const outputs = (
                options.extractOutputs && job
                ? options.extractOutputs(job.results)
                : null
              )

              updateJob(jobId, {
                completedAt: new Date(),
                outputs,
                status: "completed",
              })
            }

            completeSubject(jobId)
            unregisterJobSubscription(jobId)
          },
          error: () => {
            if (getJob(jobId)?.status === "cancelled") {
              unregisterJobSubscription(jobId)
              return
            }

            // The catchError above already wrote `failed` for us, but
            // leave defensive parity in case it's bypassed in the future.
            const job = getJob(jobId)
            if (job?.status !== "failed") {
              updateJob(jobId, {
                completedAt: new Date(),
                status: "failed",
              })
            }

            completeSubject(jobId)
            unregisterJobSubscription(jobId)
          },
        })
      )

      // Resolve the promise once the subscription is disposed for ANY
      // reason — natural complete/error from the subscriber callbacks
      // above, or external unsubscribe via cancelJob's cascade. RxJS
      // doesn't fire `complete` on external unsubscribe, so without this
      // teardown the sequenceRunner would await a child forever after
      // an umbrella cancel. Promise.resolve is idempotent, so the
      // double-fire on natural completion is a harmless no-op.
      subscription.add(() => {
        resolve(getJob(jobId))
      })

      registerJobSubscription(jobId, subscription)
    })
  })
}
