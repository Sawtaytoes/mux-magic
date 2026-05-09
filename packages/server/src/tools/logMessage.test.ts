import { describe, expect, test } from "vitest"

import { createAddColorToChalk, createLogMessage, logError, logInfo, logWarning, messageTemplate } from "./logMessage.js"
import { captureConsoleMessage } from "./captureConsoleMessage.js"
import { Chalk } from "chalk"

describe(createAddColorToChalk.name, () => {
  test("adds no colors when none passed", async () => {
    const chalk = new Chalk()

    const modifiedChalk = (
      createAddColorToChalk()(
        chalk
      )
    )

    expect(
      modifiedChalk(
        "Hello World!"
      )
    )
    .toBe(
      "Hello World!"
    )
  })

  test("adds text color", async () => {
    const chalk = new Chalk()

    const modifiedChalk = (
      createAddColorToChalk(
        "white"
      )(
        chalk
      )
    )

    expect(
      modifiedChalk(
        "Hello World!"
      )
    )
    .toBe(
      chalk
      .white(
        "Hello World!"
      )
    )
  })

  test("adds a background color", async () => {
    const chalk = new Chalk()

    const modifiedChalk = (
      createAddColorToChalk(
        "bgWhite"
      )(
        chalk
      )
    )

    expect(
      modifiedChalk(
        "Hello World!"
      )
    )
    .toBe(
      chalk
      .bgWhite(
        "Hello World!"
      )
    )
  })

  test("adds both text and background colors", async () => {
    const chalk = new Chalk()

    const modifiedChalk = (
      createAddColorToChalk(
        "bgWhite"
      )(
        createAddColorToChalk(
          "black"
        )(
          chalk
        )
      )
    )

    expect(
      modifiedChalk(
        "Hello World!"
      )
    )
    .toBe(
      chalk
      .black
      .bgWhite(
        "Hello World!"
      )
    )
  })
})

describe("messageTemplate", () => {
  test(messageTemplate.comparison.name, () => {
    expect(
      messageTemplate
      .comparison(
        "old.mkv",
        "new.mkv",
      )
    )
    .toEqual([
      "old.mkv",
      "\n",
      "new.mkv",
    ])
  })

  test(messageTemplate.descriptiveComparison.name, () => {
    expect(
      messageTemplate
      .descriptiveComparison(
        12345,
        "old.mkv",
        "new.mkv",
      )
    )
    .toEqual([
      12345,
      "\n",
      "\n",
      "old.mkv",
      "\n",
      "new.mkv",
    ])
  })

  test(messageTemplate.noItems.name, () => {
    expect(
      messageTemplate
      .noItems()
    )
    .toEqual([])
  })

  test(messageTemplate.singleItem.name, () => {
    expect(
      messageTemplate
      .singleItem(
        "new.mkv",
      )
    )
    .toEqual([
      "new.mkv",
    ])
  })
})

describe(createLogMessage.name, () => {
  test("logs only once", async () => {
    captureConsoleMessage(
      "info",
      (
        consoleSpy,
      ) => {
        createLogMessage({
          logType: "info",
        })(
          "HELLO WORLD"
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledOnce()

        expect(
          consoleSpy
          .mock
          .calls
          .at(0)
          ?.at(0)
        )
        .toContain(
          "HELLO WORLD"
        )
      }
    )
  })

  test("logs an informational message", async () => {
    captureConsoleMessage(
      "info",
      (
        consoleSpy,
      ) => {
        createLogMessage({
          logType: "info",
        })(
          "RENAMED",
          "old.mkv",
          "new.mkv",
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledWith(
          "[RENAMED]",
          "\n",
          "old.mkv",
          "\n",
          "new.mkv",
          "\n",
          "\n",
        )
      }
    )

    // TODO: TEST COLORS
  })

  test("logs an informational message", async () => {
    captureConsoleMessage(
      "info",
      (
        consoleSpy,
      ) => {
        createLogMessage({
          logType: "info",
        })(
          "RENAMED",
          "old.mkv",
          "new.mkv",
        )

        expect(
          consoleSpy
        )
        .toHaveBeenCalledWith(
          "[RENAMED]",
          "\n",
          "old.mkv",
          "\n",
          "new.mkv",
          "\n",
          "\n",
        )
      }
    )

    // TODO: TEST COLORS
  })
})

describe(logError.name, () => {
  test("logs an error message", async () => {
    captureConsoleMessage(
      "error",
      (
        consoleSpy,
      ) => {
        logError(
          "ERROR",
        )

        expect(
          consoleSpy
          .mock
          .calls
          .at(0)
          ?.at(0)
        )
        .toContain(
          "ERROR"
        )
      }
    )
  })
})

describe(logInfo.name, () => {
  test("logs an info message", async () => {
    captureConsoleMessage(
      "info",
      (
        consoleSpy,
      ) => {
        logInfo(
          "INFO",
        )

        expect(
          consoleSpy
          .mock
          .calls
          .at(0)
          ?.at(0)
        )
        .toContain(
          "INFO"
        )
      }
    )
  })
})

describe(logWarning.name, () => {
  test("logs a warning message", async () => {
    captureConsoleMessage(
      "warn",
      (
        consoleSpy,
      ) => {
        logWarning(
          "WARNING",
        )

        expect(
          consoleSpy
          .mock
          .calls
          .at(0)
          ?.at(0)
        )
        .toContain(
          "WARNING"
        )
      }
    )
  })
})
