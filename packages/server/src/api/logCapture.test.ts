import {
  __resetLogSinksForTests,
  getLogger,
  type LogRecord,
  registerLogSink,
} from "@mux-magic/tools/src/logging/logger.js"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import * as jobStore from "./jobStore.js"
import {
  getActiveJobId,
  installLogBridge,
  installLogCapture,
  originalConsole,
  stripAnsi,
  uninstallLogBridge,
  uninstallLogCapture,
  withJobContext,
} from "./logCapture.js"

afterEach(() => {
  uninstallLogCapture()
  uninstallLogBridge()
  __resetLogSinksForTests()
  jobStore.resetStore()
  vi.restoreAllMocks()
})

describe(stripAnsi.name, () => {
  test("strips color codes", () => {
    expect(stripAnsi("\x1B[32mgreen\x1B[0m")).toBe("green")
  })

  test("strips cursor codes", () => {
    expect(stripAnsi("\x1B[2Kcleared")).toBe("cleared")
  })

  test("leaves plain text unchanged", () => {
    expect(stripAnsi("plain text")).toBe("plain text")
  })
})

describe(withJobContext.name, () => {
  test("makes the job id available inside the callback", () => {
    withJobContext("job-123", () => {
      expect(getActiveJobId()).toBe("job-123")
    })
  })

  test("restores undefined after the callback returns", () => {
    withJobContext("job-123", () => {})

    expect(getActiveJobId()).toBeUndefined()
  })

  test("returns the callback's return value", () => {
    const result = withJobContext("job-123", () => 42)

    expect(result).toBe(42)
  })
})

describe(installLogCapture.name, () => {
  beforeEach(() => {
    installLogCapture()
  })

  test("still calls the original console method", () => {
    const spy = vi
      .spyOn(originalConsole, "log")
      .mockImplementation(() => {})

    console.log("hello")

    expect(spy).toHaveBeenCalledWith("hello")
  })

  test("routes console.log to appendJobLog when inside a job context", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")
    const job = jobStore.createJob({ commandName: "test" })

    withJobContext(job.id, () => {
      console.log("log line")
    })

    expect(appendSpy).toHaveBeenCalledWith(
      job.id,
      expect.stringContaining("log line"),
    )
  })

  test("strips ANSI codes before appending", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")
    const job = jobStore.createJob({ commandName: "test" })

    withJobContext(job.id, () => {
      console.log("\x1B[32mcolored\x1B[0m")
    })

    expect(appendSpy).toHaveBeenCalledWith(
      job.id,
      expect.stringContaining("colored"),
    )
  })

  test("does not call appendJobLog outside a job context", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")

    console.log("orphan line")

    expect(appendSpy).not.toHaveBeenCalled()
  })

  test("routes console.error inside a job context", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")
    const job = jobStore.createJob({ commandName: "test" })

    withJobContext(job.id, () => {
      console.error("an error")
    })

    expect(appendSpy).toHaveBeenCalledWith(
      job.id,
      expect.stringContaining("an error"),
    )
  })
})

describe(installLogBridge.name, () => {
  beforeEach(() => {
    installLogBridge()
  })

  test("routes structured logger calls inside a job context to appendJobLog", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")
    const job = jobStore.createJob({ commandName: "test" })

    withJobContext(job.id, () => {
      getLogger().info("structured line", { stepIndex: 2 })
    })

    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(appendSpy).toHaveBeenCalledWith(
      job.id,
      expect.stringContaining("structured line"),
    )
    expect(appendSpy).toHaveBeenCalledWith(
      job.id,
      expect.stringContaining("stepIndex=2"),
    )
  })

  test("does not call appendJobLog when the structured logger fires outside a job context", () => {
    const appendSpy = vi.spyOn(jobStore, "appendJobLog")

    getLogger().info("orphan structured line")

    expect(appendSpy).not.toHaveBeenCalled()
  })

  test("withJobContext seeds the structured logger's jobId field", () => {
    let records: readonly LogRecord[] = []
    registerLogSink((record) => {
      records = records.concat(record)
    })

    const job = jobStore.createJob({ commandName: "test" })
    withJobContext(job.id, () => {
      getLogger().info("hi")
    })

    expect(records[0]?.jobId).toBe(job.id)
  })
})
