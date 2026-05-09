import { throwError } from "rxjs"
import { describe, expect, test } from "vitest"

import { captureLogMessage } from "./captureLogMessage.js"
import { logAndRethrow } from "./logAndRethrow.js"
import { runTestScheduler } from "./test-runners.js"

describe(logAndRethrow.name, () => {
  test("logs the error and re-emits it so downstream catchError handlers fire", async () => {
    captureLogMessage(
      "error",
      (
        logMessageSpy
      ) => {
        runTestScheduler(({
          expectObservable,
        }) => {
          // "#" = error notification (vs. "|" for clean complete).
          // logAndSwallow returns "|"; logAndRethrow must return "#" with
          // the original error preserved.
          expectObservable(
            throwError(() => (
              "test error"
            ))
            .pipe(
              logAndRethrow(
                "testFunction"
              )
            )
          )
          .toBe(
            "#",
            undefined,
            "test error",
          )
        })

        expect(
          logMessageSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          logMessageSpy
          .mock
          .calls
          [0]
          .find((
            text
          ) => (
            text
            .includes(
              "testFunction"
            )
          ))
        )
        .toContain(
          "testFunction"
        )
      }
    )
  })

  test("logs an error buffer and re-emits the original error", async () => {
    captureLogMessage(
      "error",
      (
        logMessageSpy
      ) => {
        runTestScheduler(({
          expectObservable,
        }) => {
          const errorBuffer = Buffer.from("test error")
          expectObservable(
            throwError(() => errorBuffer)
            .pipe(
              logAndRethrow(
                "testFunction"
              )
            )
          )
          .toBe(
            "#",
            undefined,
            errorBuffer,
          )
        })

        expect(
          logMessageSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          logMessageSpy
          .mock
          .calls
          [0]
          .find((
            text
          ) => (
            text
            .includes(
              "test error"
            )
          ))
        )
        .toBe(
          "test error"
        )
      }
    )
  })
})
