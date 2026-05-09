import { describe, expect, test } from "vitest"

import { captureConsoleMessage } from "./captureConsoleMessage.js"

describe(captureConsoleMessage.name, () => {
  test("captures a console log message", async () => {
    const testMessage = "test message"

    captureConsoleMessage(
      "log",
      (
        consoleSpy,
      ) => {
        console
        .log(
          testMessage
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          consoleSpy
        )
        .toHaveBeenCalledWith(
          testMessage
        )
      },
    )
  })

  test("captures multiple console log args", async () => {
    const testMessages = [
      "test message 1",
      "test message 2",
      "test message 3",
    ]

    captureConsoleMessage(
      "log",
      (
        consoleSpy,
      ) => {
        console
        .log(
          testMessages[0],
          testMessages[1],
          testMessages[2],
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          consoleSpy
        )
        .toHaveBeenCalledWith(
          testMessages[0],
          testMessages[1],
          testMessages[2],
        )
      },
    )
  })

  test("captures multiple console log messages", async () => {
    const testMessages = [
      "test message 1",
      "test message 2",
      "test message 3",
    ]

    captureConsoleMessage(
      "log",
      (
        consoleSpy,
      ) => {
        console
        .log(
          testMessages[0]
        )

        console
        .log(
          testMessages[1]
        )

        console
        .log(
          testMessages[2]
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledTimes(3)

        expect(
          consoleSpy
        )
        .toHaveBeenNthCalledWith(
          1,
          testMessages[0],
        )

        expect(
          consoleSpy
        )
        .toHaveBeenNthCalledWith(
          2,
          testMessages[1],
        )

        expect(
          consoleSpy
        )
        .toHaveBeenNthCalledWith(
          3,
          testMessages[2],
        )
      },
    )
  })

  test("clears mock after task complete", async () => {
    const testMessage = "test message"

    const capturedConsoleSpy = (
      captureConsoleMessage(
        "log",
        (
          consoleSpy,
        ) => {
          console
          .log(
            testMessage
          )

          return consoleSpy
        },
      )
    )

    expect(
      capturedConsoleSpy
    )
    .not
    .toHaveBeenCalled()
  })

  test("captures async console log messages", async () => {
    const testMessage = "test message"

    await captureConsoleMessage(
      "log",
      async (
        consoleSpy,
      ) => {
        console
        .log(
          testMessage
        )

        await (
          Promise
          .resolve(
            consoleSpy
          )
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          consoleSpy
        )
        .toHaveBeenCalledWith(
          testMessage
        )
      },
    )
  })

  test("clears mock after async task complete", async () => {
    const testMessage = "test message"

    const capturedConsoleSpy = (
      await (
        captureConsoleMessage(
          "log",
          async (
            consoleSpy,
          ) => {
            console
            .log(
              testMessage
            )

            return (
              Promise
              .resolve(
                consoleSpy
              )
            )
          },
        )
      )
    )

    expect(
      capturedConsoleSpy
    )
    .not
    .toHaveBeenCalled()
  })

  test("doesn't capture a message when no message logged", async () => {
    captureConsoleMessage(
      "log",
      (
        consoleSpy,
      ) => {
        expect(
          consoleSpy
        )
        .not
        .toHaveBeenCalled()
      },
    )
  })
})
