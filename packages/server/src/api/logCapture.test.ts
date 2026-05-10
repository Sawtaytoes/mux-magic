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
  installLogCapture,
  originalConsole,
  stripAnsi,
  uninstallLogCapture,
  withJobContext,
} from "./logCapture.js"

afterEach(() => {
  uninstallLogCapture()
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
