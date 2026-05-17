import { Chalk } from "chalk"
import { describe, expect, test } from "vitest"
import { captureConsoleMessage } from "./captureConsoleMessage.js"
import {
  __resetLogSinksForTests,
  type LogRecord,
  registerLogSink,
} from "./logging/logger.js"
import {
  __resetLoggingModeForTests,
  setLoggingMode,
} from "./logging/mode.js"
import {
  createAddColorToChalk,
  createLogMessage,
  logError,
  logInfo,
  logWarning,
  messageTemplate,
} from "./logMessage.js"

describe(createAddColorToChalk.name, () => {
  test("adds no colors when none passed", async () => {
    const chalk = new Chalk()

    const modifiedChalk = createAddColorToChalk()(chalk)

    expect(modifiedChalk("Hello World!")).toBe(
      "Hello World!",
    )
  })

  test("adds text color", async () => {
    const chalk = new Chalk()

    const modifiedChalk =
      createAddColorToChalk("white")(chalk)

    expect(modifiedChalk("Hello World!")).toBe(
      chalk.white("Hello World!"),
    )
  })

  test("adds a background color", async () => {
    const chalk = new Chalk()

    const modifiedChalk =
      createAddColorToChalk("bgWhite")(chalk)

    expect(modifiedChalk("Hello World!")).toBe(
      chalk.bgWhite("Hello World!"),
    )
  })

  test("adds both text and background colors", async () => {
    const chalk = new Chalk()

    const modifiedChalk = createAddColorToChalk("bgWhite")(
      createAddColorToChalk("black")(chalk),
    )

    expect(modifiedChalk("Hello World!")).toBe(
      chalk.black.bgWhite("Hello World!"),
    )
  })
})

describe("messageTemplate", () => {
  test(messageTemplate.comparison.name, () => {
    expect(
      messageTemplate.comparison("old.mkv", "new.mkv"),
    ).toEqual(["old.mkv", "\n", "new.mkv"])
  })

  test(messageTemplate.descriptiveComparison.name, () => {
    expect(
      messageTemplate.descriptiveComparison(
        12345,
        "old.mkv",
        "new.mkv",
      ),
    ).toEqual([
      12345,
      "\n",
      "\n",
      "old.mkv",
      "\n",
      "new.mkv",
    ])
  })

  test(messageTemplate.noItems.name, () => {
    expect(messageTemplate.noItems()).toEqual([])
  })

  test(messageTemplate.singleItem.name, () => {
    expect(messageTemplate.singleItem("new.mkv")).toEqual([
      "new.mkv",
    ])
  })

  test(messageTemplate.multipleItems.name, () => {
    expect(
      messageTemplate.multipleItems("DOWNLOADED", [
        "a.mkv",
        "b.mkv",
        "c.mkv",
      ]),
    ).toEqual([
      "DOWNLOADED",
      "\n",
      "a.mkv",
      "\n",
      "b.mkv",
      "\n",
      "c.mkv",
      "\n",
    ])
  })
})

describe(createLogMessage.name, () => {
  test("logs only once", async () => {
    captureConsoleMessage("info", (consoleSpy) => {
      createLogMessage({
        logType: "info",
      })("HELLO WORLD")

      expect(consoleSpy).toHaveBeenCalledOnce()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("HELLO WORLD"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })
  })

  test("logs an informational message", async () => {
    captureConsoleMessage("info", (consoleSpy) => {
      createLogMessage({
        logType: "info",
      })("RENAMED", "old.mkv", "new.mkv")

      expect(consoleSpy).toHaveBeenCalledWith(
        "[RENAMED]",
        "\n",
        "old.mkv",
        "\n",
        "new.mkv",
        "\n",
        "\n",
      )
    })

    // TODO: TEST COLORS
  })

  test("dispatches to the multipleItems template when content arg 1 is an array", async () => {
    captureConsoleMessage("info", (consoleSpy) => {
      createLogMessage({
        logType: "info",
      })("DOWNLOADED", "Files downloaded:", [
        "a.mkv",
        "b.mkv",
      ])

      expect(consoleSpy).toHaveBeenCalledWith(
        "[DOWNLOADED]",
        "\n",
        "Files downloaded:",
        "\n",
        "a.mkv",
        "\n",
        "b.mkv",
        "\n",
        "\n",
        "\n",
      )
    })
  })
})

describe(logError.name, () => {
  test("logs an error message", async () => {
    captureConsoleMessage("error", (consoleSpy) => {
      logError("ERROR")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("ERROR"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })
  })
})

describe(logInfo.name, () => {
  test("logs an info message", async () => {
    captureConsoleMessage("info", (consoleSpy) => {
      logInfo("INFO")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("INFO"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })
  })
})

describe(logWarning.name, () => {
  test("logs a warning message", async () => {
    captureConsoleMessage("warn", (consoleSpy) => {
      logWarning("WARNING")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("WARNING"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })
  })
})

describe("logMessage mode-awareness", () => {
  test('"api" mode emits a structured record AND skips chalk console', () => {
    __resetLogSinksForTests()
    let records: readonly LogRecord[] = []
    registerLogSink((record) => {
      records = records.concat(record)
    })
    setLoggingMode("api")

    captureConsoleMessage("info", (consoleSpy) => {
      logInfo("SEQUENCE", "Step step1 starting.")
      expect(consoleSpy).not.toHaveBeenCalled()
    })

    __resetLoggingModeForTests()
    __resetLogSinksForTests()

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: "info",
      tag: "SEQUENCE",
      msg: "Step step1 starting.",
    })
  })

  test('"cli" mode (default) emits NO structured record', () => {
    __resetLogSinksForTests()
    let records: readonly LogRecord[] = []
    registerLogSink((record) => {
      records = records.concat(record)
    })

    captureConsoleMessage("info", () => {
      logInfo("SEQUENCE", "Step step1 starting.")
    })

    expect(records).toHaveLength(0)
    __resetLogSinksForTests()
  })

  test('"cli-debug" mode emits BOTH a structured record AND the chalk console line', () => {
    __resetLogSinksForTests()
    let records: readonly LogRecord[] = []
    registerLogSink((record) => {
      records = records.concat(record)
    })
    setLoggingMode("cli-debug")

    captureConsoleMessage("info", (consoleSpy) => {
      logInfo("SEQUENCE", "Step step1 starting.")
      expect(consoleSpy).toHaveBeenCalled()
    })

    __resetLoggingModeForTests()
    __resetLogSinksForTests()

    expect(records).toHaveLength(1)
    expect(records[0]?.tag).toBe("SEQUENCE")
  })

  test('"api" mode for logError emits a structured "error" record', () => {
    __resetLogSinksForTests()
    let records: readonly LogRecord[] = []
    registerLogSink((record) => {
      records = records.concat(record)
    })
    setLoggingMode("api")

    captureConsoleMessage("error", () => {
      logError("SEQUENCE", "boom")
    })

    __resetLoggingModeForTests()
    __resetLogSinksForTests()

    expect(records[0]).toMatchObject({
      level: "error",
      tag: "SEQUENCE",
      msg: "boom",
    })
  })

  test('"api" mode also writes errors to stderr so global error paths (crash handler, boot failures) are never silenced when no sink consumes the record', () => {
    __resetLogSinksForTests()
    setLoggingMode("api")

    const writes: string[] = []
    const originalWrite = process.stderr.write.bind(
      process.stderr,
    )
    process.stderr.write = ((chunk: unknown) => {
      writes.push(String(chunk))
      return true
    }) as typeof process.stderr.write

    try {
      logError("CRASH", "uncaughtException: oops")
    } finally {
      process.stderr.write = originalWrite
      __resetLoggingModeForTests()
    }

    expect(writes.join("")).toContain(
      "[CRASH] uncaughtException: oops",
    )
  })

  test('"api" mode does NOT write logInfo to stderr (only errors fall through)', () => {
    __resetLogSinksForTests()
    setLoggingMode("api")

    const writes: string[] = []
    const originalWrite = process.stderr.write.bind(
      process.stderr,
    )
    process.stderr.write = ((chunk: unknown) => {
      writes.push(String(chunk))
      return true
    }) as typeof process.stderr.write

    try {
      logInfo("SEQUENCE", "Step started.")
    } finally {
      process.stderr.write = originalWrite
      __resetLoggingModeForTests()
    }

    expect(writes).toHaveLength(0)
  })
})
