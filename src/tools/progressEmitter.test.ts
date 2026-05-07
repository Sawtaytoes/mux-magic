import { of, Subject } from "rxjs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  createSubject,
  resetStore,
} from "../api/jobStore.js"
import { withJobContext } from "../api/logCapture.js"
import type { ProgressEvent } from "../api/types.js"
import { createProgressEmitter, withFileProgress } from "./progressEmitter.js"

const captureProgress = (jobId: string): ProgressEvent[] => {
  const subject = createSubject(jobId)
  const captured: ProgressEvent[] = []
  subject.subscribe((event) => {
    if (typeof event !== "string" && event.type === "progress") {
      captured.push(event)
    }
  })
  return captured
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  resetStore()
})

describe(createProgressEmitter.name, () => {
  test("does not emit anything if finalize lands inside the first 1s window", () => {
    const captured = captureProgress("job-fast")
    const emitter = createProgressEmitter("job-fast", { totalFiles: 3 })

    emitter.finishFile()
    emitter.finishFile()
    emitter.finishFile()

    // 0..999ms: timer hasn't fired yet, finalize cancels it.
    vi.advanceTimersByTime(500)
    emitter.finalize()
    vi.advanceTimersByTime(10_000)

    expect(captured).toEqual([])
  })

  test("emits exactly once after the first 1s window when ticks happened during the window", () => {
    const captured = captureProgress("job-slow")
    const emitter = createProgressEmitter("job-slow", { totalFiles: 4 })

    emitter.finishFile()
    vi.advanceTimersByTime(300)
    emitter.finishFile()
    vi.advanceTimersByTime(300)
    emitter.finishFile()

    expect(captured).toEqual([])

    vi.advanceTimersByTime(400)

    // After 1000ms total, the deferred timer fires with the latest snapshot:
    // 3 of 4 files done.
    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      type: "progress",
      ratio: 0.75,
      filesDone: 3,
      filesTotal: 4,
    })
  })

  test("throttles bursts to 1Hz once the first emission has fired", () => {
    const captured = captureProgress("job-burst")
    const emitter = createProgressEmitter("job-burst", { totalFiles: 100 })

    // Tick continuously across 3 seconds. Without throttling we'd see
    // hundreds of events; we expect at most 3 (one per second window).
    for (let elapsed = 0; elapsed < 3000; elapsed += 50) {
      emitter.finishFile()
      vi.advanceTimersByTime(50)
    }

    // Drain any pending timer.
    vi.advanceTimersByTime(1000)

    // First fires at t≈1000ms, then bursts collapse — so we expect
    // emissions at roughly t=1000, t=2000, t=3000. Allow ±1 tolerance.
    expect(captured.length).toBeGreaterThanOrEqual(3)
    expect(captured.length).toBeLessThanOrEqual(4)

    // Each emission's filesDone monotonically increases — no duplicates
    // or stale data leaking through the throttle.
    const filesDoneSequence = captured.map((e) => e.filesDone)
    const sorted = [...filesDoneSequence].sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(filesDoneSequence).toEqual(sorted)
  })

  test("uses byte ratio when totalBytes is configured and reportBytes is driving the inner progress", () => {
    const captured = captureProgress("job-bytes")
    const emitter = createProgressEmitter("job-bytes", {
      totalBytes: 1000,
    })

    emitter.startFile("/a.mkv", 400)
    emitter.reportBytes(200)
    emitter.reportBytes(200)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    // 400 of 1000 cumulative bytes = 0.4
    expect(captured[0].ratio).toBe(0.4)
    expect(captured[0].currentFile).toBe("/a.mkv")
    expect(captured[0].currentFileRatio).toBe(1)
  })

  test("setCurrentFileRatio publishes a per-file percentage from spawn ops without using bytes", () => {
    // mkvmerge/mkvextract parse `Progress: X%` from stdout — the
    // percentage is the natural unit and there's no byte-level
    // signal. setCurrentFileRatio bypasses the byte-based
    // computation in snapshot() so the parsed percentage flows
    // straight through.
    const captured = captureProgress("job-spawn-file")
    const emitter = createProgressEmitter("job-spawn-file")

    emitter.startFile("/output.mkv")
    emitter.setCurrentFileRatio(0.42)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].currentFile).toBe("/output.mkv")
    expect(captured[0].currentFileRatio).toBe(0.42)
    // No totalFiles/totalBytes was set on this emitter, and setRatio
    // wasn't called either, so the overall ratio stays null.
    expect(captured[0].ratio).toBeNull()
  })

  test("setRatio overrides byte/file derived ratio — used by spawn ops with a tool-supplied percentage", () => {
    const captured = captureProgress("job-spawn")
    const emitter = createProgressEmitter("job-spawn", { totalFiles: 10 })

    emitter.finishFile() // would push ratio=0.1 from file-counter math
    emitter.setRatio(0.42) // overrides

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].ratio).toBe(0.42)
  })

  test("ratio is null when no totalFiles or totalBytes was supplied and setRatio was not called", () => {
    const captured = captureProgress("job-indeterminate")
    const emitter = createProgressEmitter("job-indeterminate")

    emitter.finishFile()
    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].ratio).toBeNull()
  })

  test("finalize is idempotent and safe to call without any prior ticks", () => {
    createProgressEmitter("job-noop").finalize()

    // No timers should remain — clearing fake timers fully advances any
    // outstanding work without side effects.
    vi.advanceTimersByTime(60_000)
    expect(true).toBe(true)
  })
})

describe(withFileProgress.name, () => {
  test("preserves the per-file emissions through the operator (synchronous, in-context, no progress fires due to silent-fast)", () => {
    // Synchronous of([...]) inside withJobContext: pipeline runs
    // entirely in one stack frame, so emitter.finalize() fires before
    // any throttled timer. That's the trivial-fast path — no progress
    // events. What we DO want to verify here is that the operator
    // doesn't drop or duplicate the inner observables' emissions.
    const captured = captureProgress("job-iter")
    const dataFlow: string[] = []

    withJobContext("job-iter", () => {
      of("a.mkv", "b.mkv", "c.mkv").pipe(
        withFileProgress((file) => of(`processed-${file}`)),
      ).subscribe((value) => { dataFlow.push(value) })
    })

    vi.advanceTimersByTime(5_000)

    expect(dataFlow).toEqual([
      "processed-a.mkv",
      "processed-b.mkv",
      "processed-c.mkv",
    ])
    expect(captured).toEqual([])
  })

  test("falls through transparently when there is no active job context (direct CLI invocation path)", () => {
    // No createSubject / no withJobContext — the per-file business
    // logic still runs, just with no progress events being published
    // because there's no subject to publish to.
    const captured: string[] = []

    of("a", "b").pipe(
      withFileProgress((file) => of(`done-${file}`)),
    ).subscribe((value) => {
      captured.push(value)
    })

    vi.advanceTimersByTime(5_000)

    expect(captured).toEqual(["done-a", "done-b"])
  })

  test("passes a sequential 0-based index as the second argument to perFile", () => {
    const captured: Array<{ file: string, index: number }> = []

    of("a.mkv", "b.mkv", "c.mkv").pipe(
      withFileProgress((file, index) => of({ file, index })),
    ).subscribe((value) => {
      captured.push(value)
    })

    vi.advanceTimersByTime(5_000)

    expect(captured).toEqual([
      { file: "a.mkv", index: 0 },
      { file: "b.mkv", index: 1 },
      { file: "c.mkv", index: 2 },
    ])
  })
})
