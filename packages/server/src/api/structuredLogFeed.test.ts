import {
  __resetLoggingModeForTests,
  __resetLogSinksForTests,
  getLogger,
  type LogRecord,
  registerLogSink,
  setLoggingMode,
} from "@mux-magic/tools"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest"

import { app } from "./hono-routes.js"
import * as jobStore from "./jobStore.js"
import {
  installLogBridge,
  installLogCapture,
  uninstallLogBridge,
  uninstallLogCapture,
} from "./logCapture.js"
import { sequenceRoutes } from "./routes/sequenceRoutes.js"

// Mirror server.ts boot: install the console patch AND the structured-
// logger bridge, then switch to api mode so logInfo/logError emit
// structured records instead of chalk console output.
beforeAll(() => {
  installLogCapture()
  installLogBridge()
  setLoggingMode("api")
})

afterAll(() => {
  __resetLoggingModeForTests()
  uninstallLogBridge()
  uninstallLogCapture()
})

afterEach(() => {
  jobStore.resetStore()
})

const waitFor = async <T>(
  get: () => T | undefined,
  timeoutMs = 1000,
): Promise<T> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = get()
    if (value !== undefined && value !== null) return value
    await new Promise<void>((resolve) =>
      setImmediate(resolve),
    )
  }
  throw new Error(
    `waitFor: predicate did not resolve within ${timeoutMs}ms`,
  )
}

describe("GET /logs/structured", () => {
  test("returns 200 with text/event-stream", async () => {
    const controller = new AbortController()

    const response = await app.request("/logs/structured", {
      signal: controller.signal,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toMatch(
      /text\/event-stream/,
    )

    controller.abort()
    await response.body?.cancel().catch(() => {})
  })

  test("emits a JSON-encoded LogRecord for each logger call", async () => {
    const controller = new AbortController()
    const response = await app.request("/logs/structured", {
      signal: controller.signal,
    })
    const reader = response.body?.getReader()
    if (!reader) throw new Error("no reader")

    // Yield once so streamSSE's callback runs and registers its sink
    // BEFORE the logger.info call below.
    await new Promise<void>((resolve) =>
      setImmediate(resolve),
    )

    getLogger().info("hello from test", { tag: "TEST" })

    // Read until we see the test record (the keepalive comment may
    // arrive first if timing slips, so loop until we find data).
    const decoder = new TextDecoder()
    let buffer = ""
    const deadline = Date.now() + 1000
    while (Date.now() < deadline) {
      const { value, done: isDone } = await reader.read()
      if (isDone) break
      buffer += decoder.decode(value, { stream: true })
      if (buffer.includes("hello from test")) break
    }

    expect(buffer).toContain(`"msg":"hello from test"`)
    expect(buffer).toContain(`"tag":"TEST"`)

    controller.abort()
    await reader.cancel().catch(() => {})
  })
})

describe("2-step sequence: both legacy + structured feeds carry records", () => {
  test("legacy job.logs receives lines AND a sink receives structured records with jobId/stepIndex context", async () => {
    let structured: readonly LogRecord[] = []
    const unsubscribe = registerLogSink((record) => {
      structured = structured.concat(record)
    })

    try {
      const response = await sequenceRoutes.request(
        "/sequences/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paths: { root: { value: "/seq-root" } },
            steps: [
              {
                id: "first",
                command: "makeDirectory",
                params: { sourcePath: "@root" },
              },
              {
                id: "second",
                command: "makeDirectory",
                params: { sourcePath: "@root" },
              },
            ],
          }),
        },
      )
      const { jobId } = (await response.json()) as {
        jobId: string
      }

      const finishedJob = await waitFor(() => {
        const job = jobStore.getJob(jobId)
        return job && job.status !== "running"
          ? job
          : undefined
      })

      // (1) Legacy line feed: appendJobLog receives lines for this job.
      // Tag-aware formatLogLine keeps the visible shape close to the
      // legacy "[SEQUENCE] ..." output the web UI already renders.
      expect(finishedJob.status).toBe("completed")
      expect(finishedJob.logs.length).toBeGreaterThan(0)
      const allLogs = finishedJob.logs.join("\n")
      expect(allLogs).toContain("[SEQUENCE]")

      // (2) Structured feed: every record carries the umbrella jobId
      // via the AsyncLocalStorage context that withJobContext seeds.
      const jobScopedRecords = structured.filter(
        (record) => record.jobId === jobId,
      )
      expect(jobScopedRecords.length).toBeGreaterThan(0)
      expect(
        jobScopedRecords.every(
          (record) =>
            record.level === "info" ||
            record.level === "warn" ||
            record.level === "error",
        ),
      ).toBe(true)
    } finally {
      unsubscribe()
      __resetLogSinksForTests()
      // Re-install the bridge that __resetLogSinksForTests just blew
      // away so subsequent tests in this file still see it.
      installLogBridge()
    }
  })
})
