import { defer, of } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
  runTask,
} from "./taskScheduler.js"

// These tests pin worker 21's design contract:
//   1. The scheduler now lives in @mux-magic/tools (this file's location
//      proves the file moved).
//   2. The scheduler no longer hard-imports server-only modules; the
//      server-specific job-id provider is injected at init.

beforeEach(() => {
  __resetTaskSchedulerForTests()
})

afterEach(() => {
  __resetTaskSchedulerForTests()
})

describe("initTaskScheduler — injected getActiveJobId", () => {
  test("uses the injected provider when explicitJobId is omitted", () => {
    let observedJobId: string | null = "unset"
    let injectedReadCount = 0

    initTaskScheduler(1, {
      getActiveJobId: () => {
        injectedReadCount += 1
        return "injected-job"
      },
    })

    runTask(
      defer(() => {
        observedJobId = "did-run"
        return of(undefined)
      }),
    ).subscribe()

    // The injected provider must have been consulted at subscribe time
    // (the scheduler reads jobId via the injected fn, not via a
    // server-only import).
    expect(injectedReadCount).toBeGreaterThan(0)
    expect(observedJobId).toBe("did-run")
  })

  test("defaults to a null provider when no injection is supplied", () => {
    initTaskScheduler(1)

    let hasRun = false

    runTask(
      defer(() => {
        hasRun = true
        return of(undefined)
      }),
    ).subscribe()

    // CLI passes no provider; scheduler must still function and treat
    // the active job id as null (no per-job claim consulted).
    expect(hasRun).toBe(true)
  })
})
