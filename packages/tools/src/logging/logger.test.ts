import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { withLoggingContext } from "./context.js"
import {
  __resetLogSinksForTests,
  getLogger,
  type LogRecord,
  registerLogSink,
} from "./logger.js"

describe(getLogger.name, () => {
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

  test("emits one record per .info call", () => {
    getLogger().info("hello")

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: "info",
      msg: "hello",
    })
  })

  test("emits one record per .debug / .warn / .error call", () => {
    const logger = getLogger()

    logger.debug("d")
    logger.warn("w")
    logger.error("e")

    expect(records.map((record) => record.level)).toEqual([
      "debug",
      "warn",
      "error",
    ])
  })

  test("attaches caller-provided extra fields to the record", () => {
    getLogger().info("step done", {
      stepIndex: 2,
      detail: "copy",
    })

    expect(records[0]).toMatchObject({
      level: "info",
      msg: "step done",
      stepIndex: 2,
      detail: "copy",
    })
  })

  test("reads jobId / stepIndex / fileId from AsyncLocalStorage context", () => {
    withLoggingContext(
      { jobId: "j1", stepIndex: 4, fileId: "f.mkv" },
      () => {
        getLogger().info("hi")
      },
    )

    expect(records[0]).toMatchObject({
      jobId: "j1",
      stepIndex: 4,
      fileId: "f.mkv",
      level: "info",
      msg: "hi",
    })
  })

  test("explicit fields override context-derived fields", () => {
    withLoggingContext({ jobId: "from-ctx" }, () => {
      getLogger().info("override", { jobId: "explicit" })
    })

    expect(records[0]).toMatchObject({
      jobId: "explicit",
      msg: "override",
    })
  })

  test("child(bindings) merges bindings into every emitted record", () => {
    const childLogger = getLogger().child({
      component: "renamer",
    })

    childLogger.info("named")
    childLogger.warn("careful")

    expect(records[0]).toMatchObject({
      component: "renamer",
      msg: "named",
    })
    expect(records[1]).toMatchObject({
      component: "renamer",
      msg: "careful",
    })
  })

  test("child bindings override context, explicit extras override child", () => {
    withLoggingContext({ stepIndex: 1 }, () => {
      const child = getLogger().child({ stepIndex: 2 })

      child.info("first")
      child.info("second", { stepIndex: 3 })
    })

    expect(records[0]?.stepIndex).toBe(2)
    expect(records[1]?.stepIndex).toBe(3)
  })

  test("registerLogSink returns an unsubscribe handle", () => {
    const sink = vi.fn()
    const unsubscribe = registerLogSink(sink)

    getLogger().info("first")
    unsubscribe()
    getLogger().info("second")

    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "first" }),
    )
  })

  test("multiple sinks each receive every record", () => {
    const sinkA = vi.fn()
    const sinkB = vi.fn()
    registerLogSink(sinkA)
    registerLogSink(sinkB)

    getLogger().info("broadcast")

    expect(sinkA).toHaveBeenCalledTimes(1)
    expect(sinkB).toHaveBeenCalledTimes(1)
  })
})
