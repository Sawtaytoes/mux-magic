import { describe, expect, test } from "vitest"

import {
  applyDeliveryOutcome,
  classifyResponseStatus,
  type DeliveryOutcome,
  getBackoffMs,
  MAX_DELIVERY_ATTEMPTS,
  type PersistedJobError,
} from "./jobErrorDeliveryStateMachine.js"

const fixedNow = new Date(
  "2026-05-15T12:00:00.000Z",
).toISOString()

const baseRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "rec_1",
  jobId: "job_1",
  level: "error",
  msg: "boom",
  occurredAt: "2026-05-15T11:59:59.000Z",
  webhookDelivery: {
    attempts: 0,
    state: "pending",
  },
  ...overrides,
})

describe("classifyResponseStatus", () => {
  test("2xx is success", () => {
    expect(classifyResponseStatus(200)).toBe("success")
    expect(classifyResponseStatus(204)).toBe("success")
  })

  test("4xx (other than 429) is rejected", () => {
    expect(classifyResponseStatus(400)).toBe("rejected")
    expect(classifyResponseStatus(404)).toBe("rejected")
    expect(classifyResponseStatus(418)).toBe("rejected")
  })

  test("429 is retryable", () => {
    expect(classifyResponseStatus(429)).toBe("retryable")
  })

  test("5xx is retryable", () => {
    expect(classifyResponseStatus(500)).toBe("retryable")
    expect(classifyResponseStatus(503)).toBe("retryable")
  })

  test("3xx and unexpected codes default to retryable", () => {
    expect(classifyResponseStatus(0)).toBe("retryable")
    expect(classifyResponseStatus(301)).toBe("retryable")
  })
})

describe("applyDeliveryOutcome", () => {
  test("pending + success -> delivered, attempts incremented, lastAttemptAt set", () => {
    const next = applyDeliveryOutcome(
      baseRecord(),
      { kind: "success" } satisfies DeliveryOutcome,
      fixedNow,
    )
    expect(next.webhookDelivery.state).toBe("delivered")
    expect(next.webhookDelivery.attempts).toBe(1)
    expect(next.webhookDelivery.lastAttemptAt).toBe(
      fixedNow,
    )
    expect(next.webhookDelivery.lastError).toBeUndefined()
  })

  test("pending + rejected -> exhausted with lastError", () => {
    const next = applyDeliveryOutcome(
      baseRecord(),
      {
        kind: "rejected",
        reason: "HTTP 404",
      } satisfies DeliveryOutcome,
      fixedNow,
    )
    expect(next.webhookDelivery.state).toBe("exhausted")
    expect(next.webhookDelivery.attempts).toBe(1)
    expect(next.webhookDelivery.lastError).toBe("HTTP 404")
  })

  test("pending + retryable below max -> stays pending with bumped attempts", () => {
    const next = applyDeliveryOutcome(
      baseRecord({
        webhookDelivery: { attempts: 2, state: "pending" },
      }),
      {
        kind: "retryable",
        reason: "HTTP 500",
      } satisfies DeliveryOutcome,
      fixedNow,
    )
    expect(next.webhookDelivery.state).toBe("pending")
    expect(next.webhookDelivery.attempts).toBe(3)
    expect(next.webhookDelivery.lastAttemptAt).toBe(
      fixedNow,
    )
    expect(next.webhookDelivery.lastError).toBe("HTTP 500")
  })

  test("pending + retryable when attempts hits MAX -> exhausted", () => {
    const next = applyDeliveryOutcome(
      baseRecord({
        webhookDelivery: {
          attempts: MAX_DELIVERY_ATTEMPTS - 1,
          state: "pending",
        },
      }),
      {
        kind: "retryable",
        reason: "network down",
      } satisfies DeliveryOutcome,
      fixedNow,
    )
    expect(next.webhookDelivery.state).toBe("exhausted")
    expect(next.webhookDelivery.attempts).toBe(
      MAX_DELIVERY_ATTEMPTS,
    )
    expect(next.webhookDelivery.lastError).toBe(
      "network down",
    )
  })

  test("input is not mutated (purity)", () => {
    const input = baseRecord()
    const before = JSON.stringify(input)
    applyDeliveryOutcome(
      input,
      { kind: "success" } satisfies DeliveryOutcome,
      fixedNow,
    )
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe("getBackoffMs", () => {
  test("schedule matches spec: 1s, 4s, 16s, 1m, 5m, 30m, then cap at 1h", () => {
    expect(getBackoffMs(1)).toBe(1_000)
    expect(getBackoffMs(2)).toBe(4_000)
    expect(getBackoffMs(3)).toBe(16_000)
    expect(getBackoffMs(4)).toBe(60_000)
    expect(getBackoffMs(5)).toBe(5 * 60_000)
    expect(getBackoffMs(6)).toBe(30 * 60_000)
    expect(getBackoffMs(7)).toBe(60 * 60_000)
    expect(getBackoffMs(8)).toBe(60 * 60_000)
    expect(getBackoffMs(99)).toBe(60 * 60_000)
  })

  test("is monotonic non-decreasing across the active range", () => {
    const range = [1, 2, 3, 4, 5, 6, 7, 8]
    const delays = range.map((attempts) =>
      getBackoffMs(attempts),
    )
    delays.slice(1).forEach((delay, index) => {
      expect(delay).toBeGreaterThanOrEqual(
        delays[index] ?? 0,
      )
    })
  })

  test("never exceeds 1 hour", () => {
    const range = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50]
    range.forEach((attempts) => {
      expect(getBackoffMs(attempts)).toBeLessThanOrEqual(
        60 * 60_000,
      )
    })
  })
})
