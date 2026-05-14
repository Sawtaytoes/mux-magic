import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

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

beforeEach(() => {
  delete process.env.WEBHOOK_JOB_STARTED_URL
  delete process.env.WEBHOOK_JOB_COMPLETED_URL
  delete process.env.WEBHOOK_JOB_FAILED_URL
})

afterEach(() => {
  vi.restoreAllMocks()
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

// ─── reportJobFailed ─────────────────────────────────────────────────────────

describe("reportJobFailed", () => {
  test("POSTs JSON with error to WEBHOOK_JOB_FAILED_URL when set", async () => {
    process.env.WEBHOOK_JOB_FAILED_URL = FAILED_URL
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobFailed({
      commandName: "copyFiles",
      error: "ENOENT: file not found",
      jobId: "abc-123",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe(FAILED_URL)
    const body = JSON.parse(init.body as string) as {
      error: { message: string }
      jobId: string
      type: string
    }
    expect(body.jobId).toBe("abc-123")
    expect(body.type).toBe("copyFiles")
    expect(body.error.message).toBe(
      "ENOENT: file not found",
    )
  })

  test("does not POST when WEBHOOK_JOB_FAILED_URL is unset", async () => {
    const fetchMock = makeFetch()
    vi.stubGlobal("fetch", fetchMock)

    await reportJobFailed({
      commandName: "copyFiles",
      error: "boom",
      jobId: "abc-123",
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─── Failure resilience ───────────────────────────────────────────────────────

describe("POST failure resilience", () => {
  test("logs a warning and does not throw when STARTED fetch returns 4xx", async () => {
    process.env.WEBHOOK_JOB_STARTED_URL = STARTED_URL
    vi.stubGlobal("fetch", makeFetch(500))
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined)

    await expect(
      reportJobStarted({
        commandName: "copyFiles",
        jobId: "abc-123",
        source: "step",
      }),
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledOnce()
  })

  test("logs a warning and does not throw when COMPLETED fetch rejects", async () => {
    process.env.WEBHOOK_JOB_COMPLETED_URL = COMPLETED_URL
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    )
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined)

    await expect(
      reportJobCompleted({
        commandName: "copyFiles",
        completedAt: new Date(),
        jobId: "abc-123",
        resultCount: 0,
        startedAt: new Date(),
      }),
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledOnce()
  })

  test("logs a warning and does not throw when FAILED fetch rejects", async () => {
    process.env.WEBHOOK_JOB_FAILED_URL = FAILED_URL
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("timeout")),
    )
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined)

    await expect(
      reportJobFailed({
        commandName: "copyFiles",
        error: "boom",
        jobId: "abc-123",
      }),
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledOnce()
  })
})
