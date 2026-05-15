export type WebhookDeliveryState =
  | "pending"
  | "delivered"
  | "exhausted"

export type WebhookDelivery = {
  state: WebhookDeliveryState
  attempts: number
  lastAttemptAt?: string
  lastError?: string
}

export type PersistedJobError = {
  id: string
  jobId: string
  stepIndex?: number
  fileId?: string
  level: "error"
  msg: string
  errorName?: string
  stack?: string
  traceId?: string
  spanId?: string
  occurredAt: string
  webhookDelivery: WebhookDelivery
}

export type DeliveryOutcome =
  | { kind: "success" }
  | { kind: "rejected"; reason: string }
  | { kind: "retryable"; reason: string }

export type ResponseClassification =
  | "success"
  | "rejected"
  | "retryable"

export const MAX_DELIVERY_ATTEMPTS = 8

// 1s, 4s, 16s, 1m, 5m, 30m, then 1h cap. Indexed by attempts (1-based).
const BACKOFF_SCHEDULE_MS: readonly number[] = [
  1_000,
  4_000,
  16_000,
  60_000,
  5 * 60_000,
  30 * 60_000,
]

const BACKOFF_CAP_MS = 60 * 60_000

export const getBackoffMs = (attempts: number): number => {
  const fromSchedule = BACKOFF_SCHEDULE_MS[attempts - 1]
  return fromSchedule !== undefined
    ? fromSchedule
    : BACKOFF_CAP_MS
}

export const classifyResponseStatus = (
  status: number,
): ResponseClassification => {
  if (status >= 200 && status < 300) return "success"
  if (status === 429) return "retryable"
  if (status >= 400 && status < 500) return "rejected"
  return "retryable"
}

export const applyDeliveryOutcome = (
  record: PersistedJobError,
  outcome: DeliveryOutcome,
  nowIso: string,
): PersistedJobError => {
  const nextAttempts = record.webhookDelivery.attempts + 1

  const isSuccess = outcome.kind === "success"
  const isRejected = outcome.kind === "rejected"
  const isRetryableExhausted =
    outcome.kind === "retryable" &&
    nextAttempts >= MAX_DELIVERY_ATTEMPTS

  const nextState: WebhookDeliveryState = isSuccess
    ? "delivered"
    : isRejected || isRetryableExhausted
      ? "exhausted"
      : "pending"

  const lastError = isSuccess ? undefined : outcome.reason

  return {
    ...record,
    webhookDelivery: {
      attempts: nextAttempts,
      lastAttemptAt: nowIso,
      lastError,
      state: nextState,
    },
  }
}
