import { mkdir } from "node:fs/promises"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  __resetDeliveryDepsForTests,
  __setDeliveryDepsForTests,
  attemptDeliveryOnce,
  cancelAllScheduledDeliveriesForTests,
  queueErrorForDelivery,
  redeliverError,
  resumePendingDeliveries,
} from "./jobErrorDeliveryQueue.js"
import {
  __resetJobErrorStoreForTests,
  addJobError,
  getJobError,
  type PersistedJobError,
} from "./jobErrorStore.js"

const storePath = "/test-delivery-queue/job-errors.json"

const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z")

const makeRecord = (
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

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  await mkdir("/test-delivery-queue", { recursive: true })
  __resetJobErrorStoreForTests(storePath)
  fetchMock = vi.fn()
  __setDeliveryDepsForTests({
    fetch: fetchMock as unknown as typeof globalThis.fetch,
    getWebhookUrl: () => "http://hook.local/failed",
    now: () => FIXED_NOW,
  })
})

afterEach(() => {
  cancelAllScheduledDeliveriesForTests()
  __resetDeliveryDepsForTests()
})

describe("attemptDeliveryOnce", () => {
  test("2xx response transitions to delivered with no further schedule", async () => {
    await addJobError(makeRecord())
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe("http://hook.local/failed")
    expect(init.method).toBe("POST")
    expect(
      (init.headers as Record<string, string>)[
        "Content-Type"
      ],
    ).toBe("application/json")
    expect(scheduleMs).toBeNull()
    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("delivered")
  })

  test("4xx non-429 transitions to exhausted with no schedule", async () => {
    await addJobError(makeRecord())
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(scheduleMs).toBeNull()
    const record = getJobError("rec_1")
    expect(record?.webhookDelivery.state).toBe("exhausted")
    expect(record?.webhookDelivery.lastError).toBe(
      "HTTP 404",
    )
  })

  test("5xx remains pending and returns a backoff schedule", async () => {
    await addJobError(makeRecord())
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
    })

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(scheduleMs).toBe(1_000) // first retry = 1s per state machine
    const record = getJobError("rec_1")
    expect(record?.webhookDelivery.state).toBe("pending")
    expect(record?.webhookDelivery.attempts).toBe(1)
    expect(record?.webhookDelivery.lastError).toBe(
      "HTTP 503",
    )
  })

  test("429 (too many requests) is treated as retryable", async () => {
    await addJobError(makeRecord())
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
    })

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(scheduleMs).toBe(1_000)
    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("pending")
  })

  test("network error remains pending and reports lastError", async () => {
    await addJobError(makeRecord())
    fetchMock.mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    )

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(scheduleMs).toBe(1_000)
    const record = getJobError("rec_1")
    expect(record?.webhookDelivery.state).toBe("pending")
    expect(record?.webhookDelivery.lastError).toContain(
      "ECONNREFUSED",
    )
  })

  test("missing webhook URL leaves record pending, does not call fetch", async () => {
    __setDeliveryDepsForTests({
      getWebhookUrl: () => undefined,
    })
    await addJobError(makeRecord())

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(fetchMock).not.toHaveBeenCalled()
    expect(scheduleMs).toBeNull()
    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("pending")
  })

  test("unknown record id is a no-op", async () => {
    const { next, scheduleMs } =
      await attemptDeliveryOnce("missing")

    expect(next).toBeUndefined()
    expect(scheduleMs).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("non-pending record is left alone", async () => {
    await addJobError(
      makeRecord({
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    )

    const { scheduleMs } =
      await attemptDeliveryOnce("rec_1")

    expect(scheduleMs).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("posted payload carries the record's identity + error details", async () => {
    await addJobError(
      makeRecord({
        errorName: "TypeError",
        msg: "cannot read property",
        stack: "stack-trace",
        traceId: "trace-1",
      }),
    )
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })

    await attemptDeliveryOnce("rec_1")

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(init.body as string) as {
      error: {
        message: string
        name: string
        stack: string
      }
      errorId: string
      jobId: string
      traceId: string
    }
    expect(body.errorId).toBe("rec_1")
    expect(body.jobId).toBe("job_1")
    expect(body.error.message).toBe("cannot read property")
    expect(body.error.name).toBe("TypeError")
    expect(body.error.stack).toBe("stack-trace")
    expect(body.traceId).toBe("trace-1")
  })
})

describe("queueErrorForDelivery + timers", () => {
  test("first attempt on success transitions to delivered, no further timers", async () => {
    vi.useFakeTimers()
    await addJobError(makeRecord())
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })

    queueErrorForDelivery("rec_1", 0)

    await vi.runOnlyPendingTimersAsync()
    // The async attempt may need a microtask to resolve.
    await vi.runAllTimersAsync()

    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("delivered")
    vi.useRealTimers()
  })
})

describe("resumePendingDeliveries", () => {
  test("queues every pending record", async () => {
    vi.useFakeTimers()
    await addJobError(makeRecord({ id: "a" }))
    await addJobError(
      makeRecord({
        id: "b",
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    )
    await addJobError(makeRecord({ id: "c" }))
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    resumePendingDeliveries()
    await vi.runAllTimersAsync()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getJobError("a")?.webhookDelivery.state).toBe(
      "delivered",
    )
    expect(getJobError("c")?.webhookDelivery.state).toBe(
      "delivered",
    )
    expect(getJobError("b")?.webhookDelivery.state).toBe(
      "delivered",
    )
    vi.useRealTimers()
  })
})

describe("redeliverError", () => {
  test("flips an exhausted record to pending and queues it", async () => {
    vi.useFakeTimers()
    await addJobError(
      makeRecord({
        webhookDelivery: {
          attempts: 8,
          lastError: "HTTP 500",
          state: "exhausted",
        },
      }),
    )
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })

    const flipped = await redeliverError("rec_1")
    expect(flipped?.webhookDelivery.state).toBe("pending")
    expect(flipped?.webhookDelivery.attempts).toBe(0)

    await vi.runAllTimersAsync()
    expect(
      getJobError("rec_1")?.webhookDelivery.state,
    ).toBe("delivered")
    vi.useRealTimers()
  })

  test("returns undefined for unknown id", async () => {
    expect(await redeliverError("missing")).toBeUndefined()
  })
})
