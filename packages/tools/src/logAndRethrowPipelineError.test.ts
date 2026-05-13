import { throwError } from "rxjs"
import { describe, expect, test } from "vitest"

import { captureLogMessage } from "./captureLogMessage.js"
import { logAndRethrowPipelineError } from "./logAndRethrowPipelineError.js"
import { runTestScheduler } from "./test-runners.js"

describe(logAndRethrowPipelineError.name, () => {
  test("logs the error and re-emits it so downstream catchError handlers fire", async () => {
    captureLogMessage("error", (logMessageSpy) => {
      runTestScheduler(({ expectObservable }) => {
        // "#" = error notification (vs. "|" for clean complete).
        // logAndSwallowPipelineError returns "|";
        // logAndRethrowPipelineError must return "#" with the original
        // error preserved.
        expectObservable(
          throwError(() => "test error").pipe(
            logAndRethrowPipelineError("testFunction"),
          ),
        ).toBe("#", undefined, "test error")
      })

      expect(logMessageSpy).toHaveBeenCalledOnce()

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("testFunction"),
        ),
      ).toContain("testFunction")
    })
  })

  test("logs an error buffer and re-emits the original error", async () => {
    captureLogMessage("error", (logMessageSpy) => {
      runTestScheduler(({ expectObservable }) => {
        const errorBuffer = Buffer.from("test error")
        expectObservable(
          throwError(() => errorBuffer).pipe(
            logAndRethrowPipelineError("testFunction"),
          ),
        ).toBe("#", undefined, errorBuffer)
      })

      expect(logMessageSpy).toHaveBeenCalledOnce()

      expect(
        logMessageSpy.mock.calls[0].find((text) =>
          text.includes("test error"),
        ),
      ).toBe("test error")
    })
  })
})
