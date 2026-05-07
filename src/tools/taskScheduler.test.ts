import { defer, Observable, of } from "rxjs"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
  runTask,
  runTasks,
} from "./taskScheduler.js"

beforeEach(() => {
  // vitest.setup.ts initializes the scheduler at Infinity for the global
  // suite. These tests need explicit per-case concurrency, so reset and
  // re-init inside each test.
  __resetTaskSchedulerForTests()
})

afterEach(() => {
  __resetTaskSchedulerForTests()
  initTaskScheduler(Infinity)
})

describe(runTask.name, () => {
  test("forwards values from the wrapped observable", async () => {
    initTaskScheduler(2)

    const collected: number[] = []

    await new Promise<void>((resolve, reject) => {
      runTask(of(1, 2, 3))
      .subscribe({
        next: (value) => collected.push(value),
        error: reject,
        complete: () => resolve(),
      })
    })

    expect(collected).toEqual([1, 2, 3])
  })

  test("caps concurrent in-flight Tasks at the configured limit", () => {
    initTaskScheduler(2)

    let runningCount = 0
    let peakRunningCount = 0
    const completers: (() => void)[] = []

    const makeWork = () => (
      new Observable<void>((subscriber) => {
        runningCount += 1
        peakRunningCount = Math.max(peakRunningCount, runningCount)

        completers.push(() => {
          runningCount -= 1
          subscriber.complete()
        })
      })
    )

    let completedCount = 0

    Array.from({ length: 4 }).forEach(() => {
      runTask(makeWork())
      .subscribe({
        complete: () => {
          completedCount += 1
        },
      })
    })

    // Two slots, four submissions: only the first two are running.
    expect(runningCount).toBe(2)
    expect(completers.length).toBe(2)

    // As each running Task completes, the next queued Task picks up its
    // slot synchronously — runningCount stays at 2 until the queue
    // empties, and completers.length stays at 2 until the last two run.
    completers.shift()!()
    expect(runningCount).toBe(2)
    expect(completers.length).toBe(2)

    completers.shift()!()
    expect(runningCount).toBe(2)
    expect(completers.length).toBe(2)

    completers.shift()!()
    expect(runningCount).toBe(1)
    expect(completers.length).toBe(1)

    completers.shift()!()
    expect(runningCount).toBe(0)
    expect(completers.length).toBe(0)

    expect(peakRunningCount).toBe(2)
    expect(completedCount).toBe(4)
  })

  test("does not start work for a queued Task that's unsubscribed before its slot opens", () => {
    initTaskScheduler(1)

    let firstStarted = false
    let secondStarted = false
    let thirdStarted = false
    let firstCompleter: (() => void) | null = null

    const firstSubscription = (
      runTask(
        new Observable<void>((subscriber) => {
          firstStarted = true
          firstCompleter = () => subscriber.complete()
        })
      )
      .subscribe()
    )

    // Second is queued behind the first.
    const secondSubscription = (
      runTask(
        defer(() => {
          secondStarted = true
          return of(undefined)
        })
      )
      .subscribe()
    )

    // Third is queued behind the second.
    runTask(
      defer(() => {
        thirdStarted = true
        return of(undefined)
      })
    )
    .subscribe()

    expect(firstStarted).toBe(true)
    expect(secondStarted).toBe(false)
    expect(thirdStarted).toBe(false)

    // Cancel the queued second BEFORE its slot opens.
    secondSubscription.unsubscribe()

    // First completes → slot frees. Second was cancelled, so the third
    // should run instead — and the second's defer must NOT fire.
    firstCompleter!()

    expect(secondStarted).toBe(false)
    expect(thirdStarted).toBe(true)

    firstSubscription.unsubscribe()
  })

  test("releases its slot when an in-flight Task is cancelled", () => {
    initTaskScheduler(1)

    let firstSubscribeCount = 0
    let firstUnsubscribeCount = 0
    let secondStarted = false

    const firstSubscription = (
      runTask(
        new Observable<void>(() => {
          firstSubscribeCount += 1
          return () => {
            firstUnsubscribeCount += 1
          }
        })
      )
      .subscribe()
    )

    runTask(
      defer(() => {
        secondStarted = true
        return of(undefined)
      })
    )
    .subscribe()

    expect(firstSubscribeCount).toBe(1)
    expect(secondStarted).toBe(false)

    // Cancel the in-flight first Task → slot frees → second runs.
    firstSubscription.unsubscribe()

    expect(firstUnsubscribeCount).toBe(1)
    expect(secondStarted).toBe(true)
  })

  test("propagates errors from the wrapped observable to the caller", async () => {
    initTaskScheduler(1)

    const error = new Error("boom")

    const result = await new Promise<unknown>((resolve) => {
      runTask(
        new Observable<never>((subscriber) => {
          subscriber.error(error)
        })
      )
      .subscribe({
        next: () => resolve("unexpected next"),
        error: (caughtError) => resolve(caughtError),
        complete: () => resolve("unexpected complete"),
      })
    })

    expect(result).toBe(error)

    // Slot must release on error too — verify by running another Task.
    let nextStarted = false
    runTask(defer(() => {
      nextStarted = true
      return of(undefined)
    }))
    .subscribe()

    expect(nextStarted).toBe(true)
  })
})

describe(runTasks.name, () => {
  test("schedules each upstream emission as a Task and forwards values", async () => {
    initTaskScheduler(Infinity)

    const collected = await new Promise<number[]>((resolve, reject) => {
      const results: number[] = []

      of(1, 2, 3)
      .pipe(
        runTasks((value) => of(value * 10)),
      )
      .subscribe({
        next: (value) => results.push(value),
        error: reject,
        complete: () => resolve(results),
      })
    })

    expect(collected.sort()).toEqual([10, 20, 30])
  })
})

describe(initTaskScheduler.name, () => {
  test("throws when re-initialized with a different concurrency", () => {
    initTaskScheduler(2)

    expect(() => initTaskScheduler(4)).toThrow(/already initialized/)
  })

  test("is idempotent when called with the same concurrency", () => {
    initTaskScheduler(2)

    expect(() => initTaskScheduler(2)).not.toThrow()
  })

  test("surfaces an error when runTask is called before initialization", () => {
    let caughtError: unknown = null

    runTask(of(1))
    .subscribe({
      error: (error) => {
        caughtError = error
      },
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toMatch(/not initialized/)
  })
})
