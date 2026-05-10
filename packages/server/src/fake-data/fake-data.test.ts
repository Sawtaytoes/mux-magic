import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { withJobContext } from "../api/logCapture.js"
import { commandNames } from "../api/routes/commandRoutes.js"
import {
  getEffectiveCommandConfigs,
  getFakeCommandConfigs,
} from "./index.js"
import { failureScenario } from "./scenarios/failure.js"
import { inProgressScenario } from "./scenarios/inProgress.js"
import { successScenario } from "./scenarios/success.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("getFakeCommandConfigs", () => {
  test("covers every real command name with a getObservable", () => {
    const configs = getFakeCommandConfigs()

    commandNames.forEach((name) => {
      expect(configs[name]).toBeDefined()
      expect(typeof configs[name].getObservable).toBe(
        "function",
      )
    })
  })

  test("preserves schema/summary metadata from the real config so OpenAPI registration stays untouched", () => {
    const fake = getFakeCommandConfigs()
    fake.makeDirectory.summary
    expect(fake.makeDirectory.summary).toMatch(/directory/i)
    expect(fake.makeDirectory.schema).toBeDefined()
  })
})

describe("getEffectiveCommandConfigs", () => {
  test("returns fake configs when useFake=true", () => {
    const fake = getEffectiveCommandConfigs(true)
    const direct = getFakeCommandConfigs()
    expect(fake).toBe(direct)
  })

  test("returns real configs when useFake=false (different observable from the fake one)", () => {
    const real = getEffectiveCommandConfigs(false)
    const fake = getEffectiveCommandConfigs(true)
    expect(real).not.toBe(fake)
    // Real config's getObservable should not be the same reference as fake's,
    // even for commands the fake table covers.
    expect(real.makeDirectory.getObservable).not.toBe(
      fake.makeDirectory.getObservable,
    )
  })
})

describe("successScenario", () => {
  test("emits one final value and completes (with timer-driven steps)", async () => {
    vi.useFakeTimers()
    const obs = successScenario(
      { foo: "bar" },
      { totalMs: 200, label: "test/success" },
    )

    const completeSpy = vi.fn()
    const nextSpy = vi.fn()

    // Run inside withJobContext so logInfo doesn't try to write to a
    // missing job (it's a no-op when the AsyncLocalStorage store is
    // unset, but a context makes the test resemble production).
    await withJobContext("fake-job-1", async () => {
      const sub = obs.subscribe({
        next: nextSpy,
        complete: completeSpy,
      })

      await vi.advanceTimersByTimeAsync(500)
      sub.unsubscribe()
    })

    expect(nextSpy).toHaveBeenCalledTimes(1)
    expect(nextSpy.mock.calls[0][0]).toMatchObject({
      ok: true,
    })
    expect(completeSpy).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  test("teardown clears the timer when subscriber unsubscribes early", async () => {
    vi.useFakeTimers()
    const obs = successScenario(
      {},
      { totalMs: 1000, label: "test/cancel" },
    )

    const nextSpy = vi.fn()
    const completeSpy = vi.fn()

    await withJobContext("fake-job-2", async () => {
      const sub = obs.subscribe({
        next: nextSpy,
        complete: completeSpy,
      })
      await vi.advanceTimersByTimeAsync(50) // before any step fires
      sub.unsubscribe()
      // Advance past the natural completion window — nothing more should fire.
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(completeSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe("failureScenario", () => {
  test("errors out with the configured message after the threshold", async () => {
    vi.useFakeTimers()
    const obs = failureScenario(
      {},
      {
        totalMs: 200,
        errorMessage: "boom!",
        label: "test/fail",
      },
    )

    const errorSpy = vi.fn()
    const completeSpy = vi.fn()

    await withJobContext("fake-job-3", async () => {
      obs.subscribe({
        error: errorSpy,
        complete: completeSpy,
      })

      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toContain(
      "boom!",
    )
    expect(completeSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe("inProgressScenario", () => {
  test("never completes on its own — only via teardown", async () => {
    vi.useFakeTimers()
    const obs = inProgressScenario(
      {},
      { tickMs: 100, label: "test/inprogress" },
    )

    const completeSpy = vi.fn()
    const errorSpy = vi.fn()

    await withJobContext("fake-job-4", async () => {
      const sub = obs.subscribe({
        complete: completeSpy,
        error: errorSpy,
      })
      await vi.advanceTimersByTimeAsync(1000)
      sub.unsubscribe()
    })

    expect(completeSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
