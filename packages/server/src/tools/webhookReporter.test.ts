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
  cancelAllScheduledDeliveriesForTests,
} from "../api/jobErrorDeliveryQueue.js"
import {
  __resetJobErrorStoreForTests,
  getJobError,
  listJobErrors,
} from "../api/jobErrorStore.js"
import {
  reportJobCompleted,
  reportJobFailed,
  reportJobStarted,
} from "./webhookReporter.js"

const STARTED_URL = "http://ha.local/webhook/started"
const COMPLETED_URL = "http://ha.local/webhook/completed"
const FAILED_URL = "http://ha.local/webhook/failed"

const makeFetch = (status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
  })

beforeEach(async () => {
  delete process.env.WEBHOOK_JOB_STARTED_URL
  delete process.env.WEBHOOK_JOB_COMPLETED_URL
  delete process.env.WEBHOOK_JOB_FAILED_URL
  await mkdir("/test-webhook-reporter", { recursive: true })
  __resetJobErrorStoreForTests(
    "/test-webhook-reporter/job-errors.json",
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  cancelAllScheduledDeliveriesForTests()
  __resetDeliveryDepsForTests()
})

// ─── reportJobStarted ────────────────────────────────────────────────────────

describe("reportJobStarted", () => {
  test("POSTs JSON to WEBHOOK_JOB_STARTED_URL when set", async () => {
    process.env.WEBHOOK_JOB_STARTED_URL = STARTED_URL
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobStarted({
      commandName: "copyFiles",
      jobId: "abc-123",
      source: "step",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe(STARTED_URL)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      jobId: "abc-123",
      type: "copyFiles",
      source: "step",
    })
    expect(
      (init.headers as Record<string, string>)[
        "Content-Type"
      ],
    ).toBe("application/json")
  })

  test("does not POST when WEBHOOK_JOB_STARTED_URL is unset", async () => {
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobStarted({
      commandName: "copyFiles",
      jobId: "abc-123",
      source: "step",
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("marks source as 'sequence' for sequence umbrella jobs", async () => {
    process.env.WEBHOOK_JOB_STARTED_URL = STARTED_URL
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobStarted({
      commandName: "sequence",
      jobId: "seq-456",
      source: "sequence",
    })

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1]
        .body as string,
    ) as { source: string }
    expect(body.source).toBe("sequence")
  })
})

// ─── reportJobCompleted ──────────────────────────────────────────────────────

describe("reportJobCompleted", () => {
  test("POSTs JSON with summary to WEBHOOK_JOB_COMPLETED_URL when set", async () => {
    process.env.WEBHOOK_JOB_COMPLETED_URL = COMPLETED_URL
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    const startedAt = new Date("2024-01-01T00:00:00Z")
    const completedAt = new Date("2024-01-01T00:00:05Z")

    await reportJobCompleted({
      commandName: "copyFiles",
      completedAt,
      jobId: "abc-123",
      resultCount: 3,
      startedAt,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe(COMPLETED_URL)
    const body = JSON.parse(init.body as string) as {
      jobId: string
      summary: { durationMs: number; resultCount: number }
      type: string
    }
    expect(body.jobId).toBe("abc-123")
    expect(body.type).toBe("copyFiles")
    expect(body.summary.resultCount).toBe(3)
    expect(body.summary.durationMs).toBe(5000)
  })

  test("does not POST when WEBHOOK_JOB_COMPLETED_URL is unset", async () => {
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobCompleted({
      commandName: "copyFiles",
      completedAt: new Date(),
      jobId: "abc-123",
      resultCount: 0,
      startedAt: new Date(),
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─── reportJobFailed (persist-first) ──────────────────────────────────────────

describe("reportJobFailed — persist-first behavior", () => {
  test("persists a pending PersistedJobError before any HTTP attempt", async () => {
    // Block the delivery fetch indefinitely so we can observe the
    // persisted state *before* delivery resolves.
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(
          () => undefined,
        ) as Promise<Response>,
    )
    __setDeliveryDepsForTests({
      fetch:
        fetchMock as unknown as typeof globalThis.fetch,
      getWebhookUrl: () => FAILED_URL,
    })

    const record = await reportJobFailed({
      commandName: "copyFiles",
      error: "ENOENT: file not found",
      jobId: "abc-123",
    })

    expect(record.webhookDelivery.state).toBe("pending")
    expect(record.webhookDelivery.attempts).toBe(0)
    expect(record.msg).toBe("ENOENT: file not found")
    expect(record.jobId).toBe("abc-123")
    expect(getJobError(record.id)?.id).toBe(record.id)
    expect(listJobErrors({})).toHaveLength(1)
  })

  test("persists even when WEBHOOK_JOB_FAILED_URL is unset (operator visibility)", async () => {
    const fetchMock = vi.fn()
    __setDeliveryDepsForTests({
      fetch:
        fetchMock as unknown as typeof globalThis.fetch,
      getWebhookUrl: () => undefined,
    })

    const record = await reportJobFailed({
      commandName: "copyFiles",
      error: "boom",
      jobId: "abc-123",
    })

    expect(getJobError(record.id)).toBeDefined()
    expect(record.webhookDelivery.state).toBe("pending")
  })

  test("posted payload reflects the persisted record's id + jobId", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 })
    __setDeliveryDepsForTests({
      fetch:
        fetchMock as unknown as typeof globalThis.fetch,
      getWebhookUrl: () => FAILED_URL,
    })

    const record = await reportJobFailed({
      commandName: "copyFiles",
      error: "boom",
      jobId: "abc-123",
    })

    await vi.runAllTimersAsync()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe(FAILED_URL)
    const body = JSON.parse(init.body as string) as {
      errorId: string
      jobId: string
    }
    expect(body.errorId).toBe(record.id)
    expect(body.jobId).toBe("abc-123")
    expect(
      getJobError(record.id)?.webhookDelivery.state,
    ).toBe("delivered")
    vi.useRealTimers()
  })
})
