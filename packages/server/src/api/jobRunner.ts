import {
  logInfo,
  registerJobClaim,
  unregisterJobClaim,
} from "@mux-magic/tools"
import { catchError, EMPTY, type Observable } from "rxjs"

import {
  reportJobCompleted,
  reportJobFailed,
  reportJobStarted,
} from "../tools/webhookReporter.js"
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
    extractOutputs?: (
      results: unknown[],
    ) => Record<string, unknown>
    // Per-job thread-count claim. When set, the task scheduler limits this
    // job to at most `threadCountClaim` concurrent tasks in addition to
    // the global MAX_THREADS cap. Registered before the observable starts
    // and torn down after it reaches a terminal state.
    threadCountClaim?: number | null
  } = {},
): Promise<Job | undefined> => {
  createSubject(jobId)

  const { threadCountClaim } = options
  if (threadCountClaim != null) {
    registerJobClaim(jobId, threadCountClaim)
  }

  const startedJob = updateJob(jobId, {
    startedAt: new Date(),
    status: "running",
  })

  void reportJobStarted({
    commandName: startedJob?.commandName ?? "",
    jobId,
    source:
      startedJob?.commandName === "sequence"
        ? "sequence"
        : "step",
  })

  return new Promise<Job | undefined>((resolve) => {
    // Run the observable inside the job's async context so all console.*
    // calls from the pipeline are routed to this job's log stream, and so
    // that runTask() can read getActiveJobId() for per-job quota tracking.
    withJobContext(jobId, () => {
      const teardownClaim = (): void => {
        if (threadCountClaim != null) {
          unregisterJobClaim(jobId)
        }
      }

      const subscription = observable
        .pipe(
          catchError((err) => {
            // Don't clobber a "cancelled" status — cancelJob already wrote
            // the terminal state and the upstream error here is just
            // fallout from unsubscribe tearing the chain down.
            if (getJob(jobId)?.status === "cancelled")
              return EMPTY

            const failedJob = updateJob(jobId, {
              completedAt: new Date(),
              error: String(err),
              status: "failed",
            })

            void reportJobFailed({
              commandName: failedJob?.commandName ?? "",
              error: String(err),
              jobId,
            })

            return EMPTY
          }),
        )
        .subscribe({
          next: (value) => {
            const job = getJob(jobId)

            if (!job) return

            logInfo(
              "EMISSION ".concat(job.commandName),
              JSON.stringify(value),
            )

            updateJob(jobId, {
              results: job.results.concat(value),
            })
          },
          complete: () => {
            const job = getJob(jobId)

            // Same guard as above — preserve the terminal status set by
            // cancelJob even if the inner pipeline races to complete first.
            if (job?.status === "cancelled") {
              teardownClaim()
              unregisterJobSubscription(jobId)
              return
            }

            if (job?.status !== "failed") {
              const outputs =
                options.extractOutputs && job
                  ? options.extractOutputs(job.results)
                  : null

              const completedAt = new Date()
              updateJob(jobId, {
                completedAt,
                outputs,
                status: "completed",
              })

              void reportJobCompleted({
                commandName: job?.commandName ?? "",
                completedAt,
                jobId,
                resultCount: job?.results.length ?? 0,
                startedAt: job?.startedAt ?? null,
              })
            }

            teardownClaim()
            completeSubject(jobId)
            unregisterJobSubscription(jobId)
          },
          error: () => {
            if (getJob(jobId)?.status === "cancelled") {
              teardownClaim()
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

            teardownClaim()
            completeSubject(jobId)
            unregisterJobSubscription(jobId)
          },
        })

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
