import { randomUUID } from "node:crypto"

import {
  getLoggingContext,
  logWarning,
} from "@mux-magic/tools"

import { queueErrorForDelivery } from "../api/jobErrorDeliveryQueue.js"
import {
  addJobError,
  type PersistedJobError,
} from "../api/jobErrorStore.js"

const postWebhook = async (
  url: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })

    if (!response.ok) {
      logWarning(
        "WEBHOOK",
        `POST ${url} returned ${response.status} — ignoring`,
      )
    }
  } catch (error) {
    logWarning(
      "WEBHOOK",
      `POST ${url} failed: ${String(error)} — ignoring`,
    )
  }
}

// Crash-path webhook. Called from `process.on("uncaughtException" |
// "unhandledRejection")` in `server.ts` right before `process.exit(1)`.
// Uses its own fetch (not `postWebhook`) because:
//   - the process is about to die: a 5s AbortController cap stops a dead
//     receiver from extending the restart by Node's default DNS/TCP
//     timeouts (~75s+ on Linux),
//   - failures here can't be logged through the normal sink — best-effort
//     `console.error` is the floor.
export const reportProcessCrashed = async ({
  reason,
  source,
  stack,
}: {
  reason: string
  source: "uncaughtException" | "unhandledRejection"
  stack: string | null
}): Promise<void> => {
  const url = process.env.WEBHOOK_PROCESS_CRASHED_URL
  if (!url) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, {
      body: JSON.stringify({
        occurredAt: new Date().toISOString(),
        reason,
        source,
        stack,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
  } catch (error) {
    console.error(
      `[WEBHOOK] Crash webhook POST failed: ${String(error)}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

export const reportJobStarted = async ({
  commandName,
  jobId,
  source,
}: {
  commandName: string
  jobId: string
  source: "sequence" | "step"
}): Promise<void> => {
  const url = process.env.WEBHOOK_JOB_STARTED_URL
  if (!url) return

  await postWebhook(url, {
    jobId,
    source,
    type: commandName,
  })
}

export const reportJobCompleted = async ({
  commandName,
  completedAt,
  jobId,
  resultCount,
  startedAt,
}: {
  commandName: string
  completedAt: Date
  jobId: string
  resultCount: number
  startedAt: Date | null
}): Promise<void> => {
  const url = process.env.WEBHOOK_JOB_COMPLETED_URL
  if (!url) return

  const durationMs =
    startedAt !== null
      ? completedAt.getTime() - startedAt.getTime()
      : null

  await postWebhook(url, {
    jobId,
    summary: { durationMs, resultCount },
    type: commandName,
  })
}

// `reportJobFailed` is now persist-first: every failure produces an
// on-disk `PersistedJobError` record before any HTTP attempt. The
// delivery queue picks up the record asynchronously, retries on 5xx /
// 429 / network errors with the documented backoff schedule, and
// short-circuits to `exhausted` on 4xx-non-429. Boot-time replay (see
// `server.ts`) resumes any records left in `pending` from a previous
// process. Even with `WEBHOOK_JOB_FAILED_URL` unset, the record is still
// persisted so operators can see and dismiss it via `/api/errors`.
export const reportJobFailed = async ({
  commandName,
  error,
  jobId,
}: {
  commandName: string
  error: string
  jobId: string
}): Promise<PersistedJobError> => {
  const context = getLoggingContext()
  const record: PersistedJobError = {
    errorName: commandName,
    fileId: context.fileId,
    id: randomUUID(),
    jobId,
    level: "error",
    msg: error,
    occurredAt: new Date().toISOString(),
    spanId: context.spanId,
    stepIndex: context.stepIndex,
    traceId: context.traceId,
    webhookDelivery: {
      attempts: 0,
      state: "pending",
    },
  }

  await addJobError(record)
  queueErrorForDelivery(record.id, 0)
  return record
}
