import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
} from "@mux-magic/server/src/tools/taskScheduler.js"

describe("initTaskSchedulerCli", () => {
  beforeEach(() => {
    __resetTaskSchedulerForTests()
    vi.resetModules()
  })

  test("its module body locks the task scheduler at concurrency=1", async () => {
    await import("./initTaskSchedulerCli.js")

    expect(() => {
      initTaskScheduler(1)
    }).not.toThrow()

    expect(() => {
      initTaskScheduler(2)
    }).toThrow(/concurrency=1/)
  })
})
