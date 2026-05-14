import { defer, EMPTY, Observable, of, Subject } from "rxjs"
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
  mergeMapOrdered,
  registerJobClaim,
  runTask,
  runTasks,
  runTasksOrdered,
  unregisterJobClaim,
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
      runTask(of(1, 2, 3)).subscribe({
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

    const makeWork = () =>
      new Observable<void>((subscriber) => {
        runningCount += 1
        peakRunningCount = Math.max(
          peakRunningCount,
          runningCount,
        )

        completers.push(() => {
          runningCount -= 1
          subscriber.complete()
        })
      })

    let completedCount = 0

    Array.from({ length: 4 }).forEach(() => {
      runTask(makeWork()).subscribe({
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
    completers.shift()?.()
    expect(runningCount).toBe(2)
    expect(completers.length).toBe(2)

    completers.shift()?.()
    expect(runningCount).toBe(2)
    expect(completers.length).toBe(2)

    completers.shift()?.()
    expect(runningCount).toBe(1)
    expect(completers.length).toBe(1)

    completers.shift()?.()
    expect(runningCount).toBe(0)
    expect(completers.length).toBe(0)

    expect(peakRunningCount).toBe(2)
    expect(completedCount).toBe(4)
  })

  test("does not start work for a queued Task that's unsubscribed before its slot opens", () => {
    initTaskScheduler(1)

    let hasFirstStarted = false
    let hasSecondStarted = false
    let hasThirdStarted = false
    let firstCompleter: (() => void) | null = null

    const firstSubscription = runTask(
      new Observable<void>((subscriber) => {
        hasFirstStarted = true
        firstCompleter = () => subscriber.complete()
      }),
    ).subscribe()

    // Second is queued behind the first.
    const secondSubscription = runTask(
      defer(() => {
        hasSecondStarted = true
        return of(undefined)
      }),
    ).subscribe()

    // Third is queued behind the second.
    runTask(
      defer(() => {
        hasThirdStarted = true
        return of(undefined)
      }),
    ).subscribe()

    expect(hasFirstStarted).toBe(true)
    expect(hasSecondStarted).toBe(false)
    expect(hasThirdStarted).toBe(false)

    // Cancel the queued second BEFORE its slot opens.
    secondSubscription.unsubscribe()

    // First completes → slot frees. Second was cancelled, so the third
    // should run instead — and the second's defer must NOT fire.
    // TypeScript 6 CFA narrows firstCompleter to null (sees only initial
    // value; can't prove Observable callback ran synchronously). The cast
    // bypasses that — the callback always runs sync on subscribe().
    ;(firstCompleter as (() => void) | null)?.()

    expect(hasSecondStarted).toBe(false)
    expect(hasThirdStarted).toBe(true)

    firstSubscription.unsubscribe()
  })

  test("releases its slot when an in-flight Task is cancelled", () => {
    initTaskScheduler(1)

    let firstSubscribeCount = 0
    let firstUnsubscribeCount = 0
    let hasSecondStarted = false

    const firstSubscription = runTask(
      new Observable<void>(() => {
        firstSubscribeCount += 1
        return () => {
          firstUnsubscribeCount += 1
        }
      }),
    ).subscribe()

    runTask(
      defer(() => {
        hasSecondStarted = true
        return of(undefined)
      }),
    ).subscribe()

    expect(firstSubscribeCount).toBe(1)
    expect(hasSecondStarted).toBe(false)

    // Cancel the in-flight first Task → slot frees → second runs.
    firstSubscription.unsubscribe()

    expect(firstUnsubscribeCount).toBe(1)
    expect(hasSecondStarted).toBe(true)
  })

  test("propagates errors from the wrapped observable to the caller", async () => {
    initTaskScheduler(1)

    const error = new Error("boom")

    const result = await new Promise<unknown>((resolve) => {
      runTask(
        new Observable<never>((subscriber) => {
          subscriber.error(error)
        }),
      ).subscribe({
        next: () => resolve("unexpected next"),
        error: (caughtError) => resolve(caughtError),
        complete: () => resolve("unexpected complete"),
      })
    })

    expect(result).toBe(error)

    // Slot must release on error too — verify by running another Task.
    let hasNextStarted = false
    runTask(
      defer(() => {
        hasNextStarted = true
        return of(undefined)
      }),
    ).subscribe()

    expect(hasNextStarted).toBe(true)
  })
})

describe(runTasks.name, () => {
  test("schedules each upstream emission as a Task and forwards values", async () => {
    initTaskScheduler(Infinity)

    const collected = await new Promise<number[]>(
      (resolve, reject) => {
        const results: number[] = []

        of(1, 2, 3)
          .pipe(runTasks((value) => of(value * 10)))
          .subscribe({
            next: (value) => results.push(value),
            error: reject,
            complete: () => resolve(results),
          })
      },
    )

    expect(collected.sort()).toEqual([10, 20, 30])
  })
})

describe(runTasksOrdered.name, () => {
  test("emits results in input-index order even when later Tasks finish first", () => {
    initTaskScheduler(Infinity)

    const collected: string[] = []
    const completers = new Map<number, () => void>()

    const work = (value: string, index: number) =>
      new Observable<string>((subscriber) => {
        completers.set(index, () => {
          subscriber.next(`done-${value}`)
          subscriber.complete()
        })
      })

    of("a", "b", "c", "d")
      .pipe(runTasksOrdered(work))
      .subscribe({
        next: (value) => {
          collected.push(value)
        },
      })

    // All four Tasks are running (Infinity concurrency).
    expect(completers.size).toBe(4)
    // Nothing has emitted yet — no Task completed.
    expect(collected).toEqual([])

    // Complete in reverse order: d, c, b, a.
    completers.get(3)?.()
    expect(collected).toEqual([])
    completers.get(2)?.()
    expect(collected).toEqual([])
    completers.get(1)?.()
    expect(collected).toEqual([])
    // Now the head-of-queue completes — all four flush at once in input order.
    completers.get(0)?.()
    expect(collected).toEqual([
      "done-a",
      "done-b",
      "done-c",
      "done-d",
    ])
  })

  test("releases each result as soon as the head-of-queue completes", () => {
    initTaskScheduler(Infinity)

    const collected: string[] = []
    const completers = new Map<number, () => void>()

    const work = (value: string, index: number) =>
      new Observable<string>((subscriber) => {
        completers.set(index, () => {
          subscriber.next(`done-${value}`)
          subscriber.complete()
        })
      })

    of("a", "b", "c")
      .pipe(runTasksOrdered(work))
      .subscribe({
        next: (value) => {
          collected.push(value)
        },
      })

    // Complete head first → emits immediately.
    completers.get(0)?.()
    expect(collected).toEqual(["done-a"])

    // Skip 1, complete 2 → must wait for 1.
    completers.get(2)?.()
    expect(collected).toEqual(["done-a"])

    // Complete 1 → both 1 and 2 flush.
    completers.get(1)?.()
    expect(collected).toEqual([
      "done-a",
      "done-b",
      "done-c",
    ])
  })

  test("preserves multi-emission order within a Task and across Tasks", () => {
    initTaskScheduler(Infinity)

    const collected: string[] = []

    of("a", "b")
      .pipe(
        runTasksOrdered((value) =>
          of(`${value}-1`, `${value}-2`),
        ),
      )
      .subscribe({
        next: (collected_value) => {
          collected.push(collected_value)
        },
      })

    expect(collected).toEqual(["a-1", "a-2", "b-1", "b-2"])
  })

  test("propagates errors from upstream", () => {
    initTaskScheduler(Infinity)

    const errored = new Subject<void>()
    let caughtError: unknown = null

    const upstream = new Subject<number>()
    upstream
      .pipe(runTasksOrdered((value) => of(value * 10)))
      .subscribe({
        error: (error) => {
          caughtError = error
          errored.next()
        },
      })

    upstream.error(new Error("upstream boom"))

    expect((caughtError as Error).message).toBe(
      "upstream boom",
    )
  })

  test("propagates errors from a Task", () => {
    initTaskScheduler(Infinity)

    let caughtError: unknown = null

    of(1, 2, 3)
      .pipe(
        runTasksOrdered((value) =>
          value === 2
            ? new Observable<number>((subscriber) => {
                subscriber.error(new Error("task-2 failed"))
              })
            : of(value),
        ),
      )
      .subscribe({
        error: (error) => {
          caughtError = error
        },
      })

    expect((caughtError as Error).message).toBe(
      "task-2 failed",
    )
  })

  test("completes immediately on empty upstream", () => {
    initTaskScheduler(Infinity)

    let isComplete = false

    EMPTY.pipe(
      runTasksOrdered((value: number) => of(value)),
    ).subscribe({
      complete: () => {
        isComplete = true
      },
    })

    expect(isComplete).toBe(true)
  })

  test("unsubscribe tears down in-flight Tasks", () => {
    initTaskScheduler(Infinity)

    let workSubscribeCount = 0
    let workUnsubscribeCount = 0

    const subscription = of(1, 2, 3)
      .pipe(
        runTasksOrdered(
          () =>
            new Observable(() => {
              workSubscribeCount += 1
              return () => {
                workUnsubscribeCount += 1
              }
            }),
        ),
      )
      .subscribe()

    expect(workSubscribeCount).toBe(3)

    subscription.unsubscribe()

    expect(workUnsubscribeCount).toBe(3)
  })
})

describe(mergeMapOrdered.name, () => {
  test("orders results without involving the Task scheduler", () => {
    // No initTaskScheduler call — proves the operator works when the
    // scheduler isn't initialized at all (it shouldn't reach runTask).
    __resetTaskSchedulerForTests()

    const collected: string[] = []
    const completers = new Map<number, () => void>()

    const work = (value: string, index: number) =>
      new Observable<string>((subscriber) => {
        completers.set(index, () => {
          subscriber.next(`done-${value}`)
          subscriber.complete()
        })
      })

    of("a", "b", "c")
      .pipe(mergeMapOrdered(work))
      .subscribe({
        next: (value) => {
          collected.push(value)
        },
      })

    expect(completers.size).toBe(3)

    completers.get(2)?.()
    completers.get(1)?.()
    expect(collected).toEqual([])

    completers.get(0)?.()
    expect(collected).toEqual([
      "done-a",
      "done-b",
      "done-c",
    ])
  })
})

describe("per-job quota — runTask with explicit jobId", () => {
  const makeWork = (
    runningRef: { count: number },
    completers: Array<() => void>,
  ) =>
    new Observable<void>((subscriber) => {
      runningRef.count += 1
      completers.push(() => {
        runningRef.count -= 1
        subscriber.complete()
      })
    })

  test("single job: per-job cap of 1 serialises tasks even when global pool has room", () => {
    initTaskScheduler(8)
    registerJobClaim("job-a", 1)

    const runningA = { count: 0 }
    const completersA: Array<() => void> = []

    runTask(
      makeWork(runningA, completersA),
      "job-a",
    ).subscribe()
    runTask(
      makeWork(runningA, completersA),
      "job-a",
    ).subscribe()

    expect(runningA.count).toBe(1)
    expect(completersA.length).toBe(1)

    completersA[0]()
    expect(runningA.count).toBe(1)
    expect(completersA.length).toBe(2)

    completersA[1]()
    expect(runningA.count).toBe(0)

    unregisterJobClaim("job-a")
  })

  test("per-job cap does not block tasks from a different job", () => {
    initTaskScheduler(8)
    registerJobClaim("job-a", 1)
    registerJobClaim("job-b", 4)

    const runningA = { count: 0 }
    const runningB = { count: 0 }
    const completersA: Array<() => void> = []
    const completersB: Array<() => void> = []

    runTask(
      makeWork(runningA, completersA),
      "job-a",
    ).subscribe()
    runTask(
      makeWork(runningA, completersA),
      "job-a",
    ).subscribe()
    runTask(
      makeWork(runningB, completersB),
      "job-b",
    ).subscribe()
    runTask(
      makeWork(runningB, completersB),
      "job-b",
    ).subscribe()

    // job-a capped at 1; job-b can run 2 (both fit in global pool)
    expect(runningA.count).toBe(1)
    expect(runningB.count).toBe(2)

    completersA.forEach((completer) => {
      completer()
    })
    completersB.forEach((completer) => {
      completer()
    })

    unregisterJobClaim("job-a")
    unregisterJobClaim("job-b")
  })

  test("global pool limits job B to remaining slots while job A occupies its claim", () => {
    // MAX_THREADS=8, job A claim=4, job B claim=8.
    // While A occupies 4 global slots, B can only use the remaining 4.
    // After A finishes, B can use all 8.
    initTaskScheduler(8)
    registerJobClaim("job-a", 4)
    registerJobClaim("job-b", 8)

    const runningA = { count: 0 }
    const runningB = { count: 0 }
    const completersA: Array<() => void> = []
    const completersB: Array<() => void> = []

    // 4 tasks for A + 8 for B
    Array.from({ length: 4 }).forEach(() => {
      runTask(
        makeWork(runningA, completersA),
        "job-a",
      ).subscribe()
    })
    Array.from({ length: 8 }).forEach(() => {
      runTask(
        makeWork(runningB, completersB),
        "job-b",
      ).subscribe()
    })

    // A fills its claim (4); B gets the remaining 4 global slots.
    expect(runningA.count).toBe(4)
    expect(runningB.count).toBe(4)
    // 4 B tasks are still queued.
    expect(completersB.length).toBe(4)

    // Complete all A tasks one by one — each frees a slot that B claims.
    completersA[0]()
    expect(runningB.count).toBe(5)
    completersA[1]()
    expect(runningB.count).toBe(6)
    completersA[2]()
    expect(runningB.count).toBe(7)
    completersA[3]()
    expect(runningB.count).toBe(8)

    expect(runningA.count).toBe(0)

    completersB.forEach((completer) => {
      completer()
    })

    unregisterJobClaim("job-a")
    unregisterJobClaim("job-b")
  })

  test("tasks with no jobId (null) are gated only by the global cap", () => {
    initTaskScheduler(2)

    const running = { count: 0 }
    const completers: Array<() => void> = []

    runTask(makeWork(running, completers), null).subscribe()
    runTask(makeWork(running, completers), null).subscribe()
    runTask(makeWork(running, completers), null).subscribe()

    // Only 2 admitted (global cap); no per-job quota applies.
    expect(running.count).toBe(2)
    expect(completers.length).toBe(2)

    completers[0]()
    expect(running.count).toBe(2)
    expect(completers.length).toBe(3)

    completers[1]()
    completers[2]()
    expect(running.count).toBe(0)
  })
})

describe(initTaskScheduler.name, () => {
  test("throws when re-initialized with a different concurrency", () => {
    initTaskScheduler(2)

    expect(() => initTaskScheduler(4)).toThrow(
      /already initialized/,
    )
  })

  test("is idempotent when called with the same concurrency", () => {
    initTaskScheduler(2)

    expect(() => initTaskScheduler(2)).not.toThrow()
  })

  test("surfaces an error when runTask is called before initialization", () => {
    let caughtError: unknown = null

    runTask(of(1)).subscribe({
      error: (error) => {
        caughtError = error
      },
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toMatch(
      /not initialized/,
    )
  })
})
