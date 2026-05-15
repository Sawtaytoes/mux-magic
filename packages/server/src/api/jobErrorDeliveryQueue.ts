import {
  applyDeliveryOutcome,
  classifyResponseStatus,
  type DeliveryOutcome,
  getBackoffMs,
  type PersistedJobError,
} from "./jobErrorDeliveryStateMachine.js"
import {
  getJobError,
  listJobErrors,
  updateJobError,
} from "./jobErrorStore.js"

type DeliveryDeps = {
  fetch: typeof globalThis.fetch
  getWebhookUrl: () => string | undefined
  now: () => Date
}

const defaultDeps: DeliveryDeps = {
  fetch: globalThis.fetch.bind(globalThis),
  getWebhookUrl: () => process.env.WEBHOOK_JOB_FAILED_URL,
  now: () => new Date(),
}

let activeDeps: DeliveryDeps = { ...defaultDeps }

export const __setDeliveryDepsForTests = (
  overrides: Partial<DeliveryDeps>,
): void => {
  activeDeps = { ...activeDeps, ...overrides }
}

export const __resetDeliveryDepsForTests = (): void => {
  activeDeps = { ...defaultDeps }
}

const buildPayload = (
  record: PersistedJobError,
): Record<string, unknown> => ({
  attempts: record.webhookDelivery.attempts,
  error: {
    message: record.msg,
    name: record.errorName,
    stack: record.stack,
  },
  errorId: record.id,
  fileId: record.fileId,
  jobId: record.jobId,
  level: record.level,
  occurredAt: record.occurredAt,
  spanId: record.spanId,
  stepIndex: record.stepIndex,
  traceId: record.traceId,
})

const runFetchAttempt = async (
  url: string,
  record: PersistedJobError,
): Promise<DeliveryOutcome> => {
  try {
    const response = await activeDeps.fetch(url, {
      body: JSON.stringify(buildPayload(record)),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
    const classification = classifyResponseStatus(
      response.status,
    )
    if (classification === "success") {
      return { kind: "success" }
    }
    const reason = `HTTP ${response.status}`
    if (classification === "rejected") {
      return { kind: "rejected", reason }
    }
    return { kind: "retryable", reason }
  } catch (error) {
    return {
      kind: "retryable",
      reason:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

export type AttemptDeliveryResult = {
  next: PersistedJobError | undefined
  scheduleMs: number | null
}

export const attemptDeliveryOnce = async (
  recordId: string,
): Promise<AttemptDeliveryResult> => {
  const current = getJobError(recordId)
  if (!current) {
    return { next: undefined, scheduleMs: null }
  }
  if (current.webhookDelivery.state !== "pending") {
    return { next: current, scheduleMs: null }
  }

  const url = activeDeps.getWebhookUrl()
  if (url === undefined || url === "") {
    // No webhook configured. Leave pending; nothing to retry.
    return { next: current, scheduleMs: null }
  }

  const outcome = await runFetchAttempt(url, current)
  const nowIso = activeDeps.now().toISOString()
  const updated = applyDeliveryOutcome(
    current,
    outcome,
    nowIso,
  )

  await updateJobError(recordId, () => updated)

  if (updated.webhookDelivery.state === "pending") {
    return {
      next: updated,
      scheduleMs: getBackoffMs(
        updated.webhookDelivery.attempts,
      ),
    }
  }
  return { next: updated, scheduleMs: null }
}

const timers = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

const clearTimerFor = (recordId: string): void => {
  const existing = timers.get(recordId)
  if (existing !== undefined) {
    clearTimeout(existing)
    timers.delete(recordId)
  }
}

export const queueErrorForDelivery = (
  recordId: string,
  delayMs = 0,
): void => {
  clearTimerFor(recordId)
  const timer = setTimeout(() => {
    timers.delete(recordId)
    attemptDeliveryOnce(recordId)
      .then(({ scheduleMs }) => {
        if (scheduleMs !== null) {
          queueErrorForDelivery(recordId, scheduleMs)
        }
      })
      .catch(() => undefined)
  }, delayMs)
  // Don't block process exit on the retry timer.
  if (typeof timer.unref === "function") {
    timer.unref()
  }
  timers.set(recordId, timer)
}

export const resumePendingDeliveries = (): void => {
  listJobErrors({ state: "pending" }).forEach((record) => {
    queueErrorForDelivery(record.id, 0)
  })
}

export const redeliverError = async (
  recordId: string,
): Promise<PersistedJobError | undefined> => {
  const current = getJobError(recordId)
  if (!current) return undefined

  await updateJobError(recordId, (record) => ({
    ...record,
    webhookDelivery: {
      attempts: 0,
      lastError: undefined,
      state: "pending",
    },
  }))

  const flipped = getJobError(recordId)
  if (flipped) {
    queueErrorForDelivery(recordId, 0)
  }
  return flipped
}

export const cancelAllScheduledDeliveriesForTests =
  (): void => {
    timers.forEach((timer) => {
      clearTimeout(timer)
    })
    timers.clear()
  }
