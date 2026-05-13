import { throwError } from "rxjs"
import { describe, expect, test } from "vitest"

import { captureLogMessage } from "./captureLogMessage.js"
import { logAndSwallowPipelineError } from "./logAndSwallowPipelineError.js"
import { runTestScheduler } from "./test-runners.js"

describe(logAndSwallowPipelineError.name, () => {
  test("catches a pipeline error and completes cleanly", async () => {
    captureLogMessage("error", (logMessageSpy) => {
      runTestScheduler(({ expectObservable }) => {
        expectObservable(
          throwError(() => "test error").pipe(
            logAndSwallowPipelineError("testFunction"),
          ),
        ).toBe("|")
      })

      expect(logMessageSpy).toHaveBeenCalledOnce()

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("testFunction"),
        ),
      ).toContain("testFunction")

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("test error"),
        ),
      ).toContain("test error")
    })
  })

  test("logs an error buffer", async () => {
    captureLogMessage("error", (logMessageSpy) => {
      runTestScheduler(({ expectObservable }) => {
        expectObservable(
          throwError(() => Buffer.from("test error")).pipe(
            logAndSwallowPipelineError("testFunction"),
          ),
        ).toBe("|")
      })

      expect(logMessageSpy).toHaveBeenCalledOnce()

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("testFunction"),
        ),
      ).toContain("testFunction")

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("test error"),
        ),
      ).toBe("test error")
    })
  })
})
