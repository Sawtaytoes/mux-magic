import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { getLoggingContext } from "./context.js"
import {
  __resetLogSinksForTests,
  getLogger,
  type LogRecord,
  registerLogSink,
} from "./logger.js"

describe("startSpan", () => {
  let records: readonly LogRecord[]

  beforeEach(() => {
    __resetLogSinksForTests()
    records = []
    registerLogSink((record) => {
      records = records.concat(record)
    })
  })

  afterEach(() => {
    __resetLogSinksForTests()
  })

  test("returns the value the wrapped fn returned", async () => {
    const result = await getLogger().startSpan(
      "work",
      () => 7,
    )

    expect(result).toBe(7)
  })

  test("awaits async fn results", async () => {
    const result = await getLogger().startSpan(
      "work",
      async () => {
        await Promise.resolve()
        return "done"
      },
    )

    expect(result).toBe("done")
  })

  test("emits an enter and an exit debug record sharing traceId/spanId", async () => {
    await getLogger().startSpan("work", () => undefined)

    const enter = records.find((record) =>
      record.msg.startsWith("span enter:"),
    )
    const exit = records.find((record) =>
      record.msg.startsWith("span exit:"),
    )

    expect(enter).toBeDefined()
    expect(exit).toBeDefined()
    expect(enter?.traceId).toBeTypeOf("string")
    expect(enter?.spanId).toBeTypeOf("string")
    expect(exit?.traceId).toBe(enter?.traceId)
    expect(exit?.spanId).toBe(enter?.spanId)
    expect(exit?.spanName).toBe("work")
  })

  test("exit record carries elapsedMs >= 0", async () => {
    await getLogger().startSpan("work", () => undefined)

    const exit = records.find((record) =>
      record.msg.startsWith("span exit:"),
    )

    expect(typeof exit?.elapsedMs).toBe("number")
    expect(
      exit?.elapsedMs as number,
    ).toBeGreaterThanOrEqual(0)
  })

  test("propagates traceId/spanId into the AsyncLocalStorage context", async () => {
    let innerContext = {} as ReturnType<
      typeof getLoggingContext
    >

    await getLogger().startSpan("work", () => {
      innerContext = getLoggingContext()
    })

    expect(innerContext.traceId).toBeTypeOf("string")
    expect(innerContext.spanId).toBeTypeOf("string")
  })

  test("logger.info inside fn carries the span's traceId/spanId", async () => {
    await getLogger().startSpan("work", () => {
      getLogger().info("inner")
    })

    const inner = records.find(
      (record) => record.msg === "inner",
    )

    expect(inner?.traceId).toBeTypeOf("string")
    expect(inner?.spanId).toBeTypeOf("string")
  })

  test("nested span inherits the outer traceId but gets a fresh spanId", async () => {
    let outerTraceId = ""
    let outerSpanId = ""
    let innerTraceId = ""
    let innerSpanId = ""

    await getLogger().startSpan("outer", async () => {
      const outerCtx = getLoggingContext()
      outerTraceId = outerCtx.traceId ?? ""
      outerSpanId = outerCtx.spanId ?? ""

      await getLogger().startSpan("inner", () => {
        const innerCtx = getLoggingContext()
        innerTraceId = innerCtx.traceId ?? ""
        innerSpanId = innerCtx.spanId ?? ""
      })
    })

    expect(outerTraceId).not.toBe("")
    expect(innerTraceId).toBe(outerTraceId)
    expect(innerSpanId).not.toBe("")
    expect(innerSpanId).not.toBe(outerSpanId)
  })

  test("emits an error record with elapsedMs/errorName and re-throws on throw", async () => {
    await expect(
      getLogger().startSpan("work", () => {
        throw new TypeError("nope")
      }),
    ).rejects.toBeInstanceOf(TypeError)

    const errRecord = records.find((record) =>
      record.msg.startsWith("span error:"),
    )

    expect(errRecord?.level).toBe("error")
    expect(errRecord?.errorName).toBe("TypeError")
    expect(typeof errRecord?.elapsedMs).toBe("number")
  })
})
