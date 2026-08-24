import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { createRateLimiter } from "./rateLimiter.js"

describe(createRateLimiter.name, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("starts consecutive tasks at least the interval apart", async () => {
    const rateLimiter = createRateLimiter({
      minimumIntervalMilliseconds: 1000,
    })
    const startTime = Date.now()

    const scheduled = Promise.all(
      ["first", "second", "third"].map(() =>
        rateLimiter.schedule(() => Date.now() - startTime),
      ),
    )

    await vi.advanceTimersByTimeAsync(5000)

    expect(await scheduled).toEqual([0, 1000, 2000])
  })

  test("resolves results in the order they were scheduled", async () => {
    const rateLimiter = createRateLimiter({
      minimumIntervalMilliseconds: 50,
    })

    const scheduled = Promise.all([
      rateLimiter.schedule(() => "first"),
      rateLimiter.schedule(async () => "second"),
      rateLimiter.schedule(() => "third"),
    ])

    await vi.advanceTimersByTimeAsync(500)

    expect(await scheduled).toEqual([
      "first",
      "second",
      "third",
    ])
  })

  test("keeps the queue moving after a task rejects", async () => {
    const rateLimiter = createRateLimiter({
      minimumIntervalMilliseconds: 100,
    })

    const failed = rateLimiter
      .schedule(() =>
        Promise.reject(new Error("provider exploded")),
      )
      .catch((thrownError: Error) => thrownError.message)
    const succeeded = rateLimiter.schedule(() => "after")

    await vi.advanceTimersByTimeAsync(500)

    expect(await failed).toBe("provider exploded")
    expect(await succeeded).toBe("after")
  })
})
