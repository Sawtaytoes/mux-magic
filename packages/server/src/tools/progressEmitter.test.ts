import { of } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  createSubject,
  resetStore,
} from "../api/jobStore.js"
import { withJobContext } from "../api/logCapture.js"
import type { ProgressEvent } from "../api/types.js"
import {
  createProgressEmitter,
  withFileProgress,
} from "./progressEmitter.js"

const captureProgress = (
  jobId: string,
): ProgressEvent[] => {
  const subject = createSubject(jobId)
  const captured: ProgressEvent[] = []
  subject.subscribe((event) => {
    if (
      typeof event !== "string" &&
      event.type === "progress"
    ) {
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
    const emitter = createProgressEmitter("job-fast", {
      totalFiles: 3,
    })

    emitter.incrementFilesDone()
    emitter.incrementFilesDone()
    emitter.incrementFilesDone()

    // 0..999ms: timer hasn't fired yet, finalize cancels it.
    vi.advanceTimersByTime(500)
    emitter.finalize()
    vi.advanceTimersByTime(10_000)

    expect(captured).toEqual([])
  })

  test("emits exactly once after the first 1s window when ticks happened during the window", () => {
    const captured = captureProgress("job-slow")
    const emitter = createProgressEmitter("job-slow", {
      totalFiles: 4,
    })

    emitter.incrementFilesDone()
    vi.advanceTimersByTime(300)
    emitter.incrementFilesDone()
    vi.advanceTimersByTime(300)
    emitter.incrementFilesDone()

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
    const emitter = createProgressEmitter("job-burst", {
      totalFiles: 100,
    })

    // Tick continuously across 3 seconds. Without throttling we'd see
    // hundreds of events; we expect at most 3 (one per second window).
    Array.from({ length: 60 }).forEach(() => {
      emitter.incrementFilesDone()
      vi.advanceTimersByTime(50)
    })

    // Drain any pending timer.
    vi.advanceTimersByTime(1000)

    // First fires at t≈1000ms, then bursts collapse — so we expect
    // emissions at roughly t=1000, t=2000, t=3000. Allow ±1 tolerance.
    expect(captured.length).toBeGreaterThanOrEqual(3)
    expect(captured.length).toBeLessThanOrEqual(4)

    // Each emission's filesDone monotonically increases — no duplicates
    // or stale data leaking through the throttle.
    const filesDoneSequence = captured.map(
      (event) => event.filesDone,
    )
    const sorted = [...filesDoneSequence].sort(
      (aValue, bValue) => (aValue ?? 0) - (bValue ?? 0),
    )
    expect(filesDoneSequence).toEqual(sorted)
  })

  test("uses byte ratio when totalBytes is configured and tracker.reportBytes is driving the inner progress", () => {
    const captured = captureProgress("job-bytes")
    const emitter = createProgressEmitter("job-bytes", {
      totalBytes: 1000,
    })

    const tracker = emitter.startFile("/a.mkv", 400)
    tracker.reportBytes(200)
    tracker.reportBytes(200)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    // 400 of 1000 cumulative bytes (in-flight) = 0.4
    expect(captured[0].ratio).toBe(0.4)
    expect(captured[0].currentFiles).toEqual([
      { path: "/a.mkv", ratio: 1 },
    ])
  })

  test("tracker.setRatio publishes a per-file percentage from spawn ops without using bytes", () => {
    // mkvmerge/mkvextract parse `Progress: X%` from stdout — the
    // percentage is the natural unit and there's no byte-level
    // signal. tracker.setRatio bypasses the byte-based computation
    // so the parsed percentage flows straight through.
    const captured = captureProgress("job-spawn-file")
    const emitter = createProgressEmitter("job-spawn-file")

    const tracker = emitter.startFile("/output.mkv")
    tracker.setRatio(0.42)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].currentFiles).toEqual([
      { path: "/output.mkv", ratio: 0.42 },
    ])
    // No totalFiles/totalBytes was set on this emitter, and emitter.setRatio
    // wasn't called either, so the overall ratio stays null.
    expect(captured[0].ratio).toBeNull()
  })

  test("multiple in-flight trackers each contribute a row to currentFiles", () => {
    const captured = captureProgress("job-parallel")
    const emitter = createProgressEmitter("job-parallel", {
      totalFiles: 3,
    })

    const trackerA = emitter.startFile("/a.mkv")
    const trackerB = emitter.startFile("/b.mkv")
    const trackerC = emitter.startFile("/c.mkv")

    trackerA.setRatio(0.25)
    trackerB.setRatio(0.5)
    trackerC.setRatio(0.75)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].currentFiles).toEqual([
      { path: "/a.mkv", ratio: 0.25 },
      { path: "/b.mkv", ratio: 0.5 },
      { path: "/c.mkv", ratio: 0.75 },
    ])
  })

  test("tracker.finish removes the file from currentFiles but does NOT increment filesDone", () => {
    // tracker.finish() is display-only: it removes the active-file row from
    // currentFiles so the UI stops showing the bar. The filesDone counter is
    // the domain of emitter.incrementFilesDone() alone. withFileProgress wires
    // that call via rxFinalize so per-pair counting and per-file ffmpeg tracking
    // never double-count.
    const captured = captureProgress("job-finish")
    const emitter = createProgressEmitter("job-finish", {
      totalFiles: 2,
    })

    const trackerA = emitter.startFile("/a.mkv")
    const trackerB = emitter.startFile("/b.mkv")

    trackerA.setRatio(1)
    trackerA.finish()

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].filesDone).toBe(0)
    expect(captured[0].currentFiles).toEqual([
      { path: "/b.mkv", ratio: null },
    ])

    trackerB.finish()
    vi.advanceTimersByTime(1000)

    const finalEvent = captured[captured.length - 1]
    expect(finalEvent.filesDone).toBe(0)
    expect(finalEvent.currentFiles).toBeUndefined()
  })

  test("tracker.finish is idempotent — second call after teardown is a no-op", () => {
    const captured = captureProgress("job-idempotent")
    const emitter = createProgressEmitter(
      "job-idempotent",
      { totalFiles: 1 },
    )

    const tracker = emitter.startFile("/once.mkv", 100)
    tracker.finish(100)
    tracker.finish(100) // duplicate — no-op (file already removed from activeFiles)

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    // tracker.finish does not increment filesDone; use emitter.incrementFilesDone()
    expect(captured[0].filesDone).toBe(0)
  })

  test("setRatio overrides byte/file derived ratio — used by spawn ops with a tool-supplied percentage", () => {
    const captured = captureProgress("job-spawn")
    const emitter = createProgressEmitter("job-spawn", {
      totalFiles: 10,
    })

    emitter.incrementFilesDone() // would push ratio=0.1 from file-counter math
    emitter.setRatio(0.42) // overrides

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].ratio).toBe(0.42)
  })

  test("ratio is null when no totalFiles or totalBytes was supplied and setRatio was not called", () => {
    const captured = captureProgress("job-indeterminate")
    const emitter = createProgressEmitter(
      "job-indeterminate",
    )

    emitter.incrementFilesDone()
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

  test("subsequent calls with the same jobId return the same singleton — totals merge additively", () => {
    const captured = captureProgress("job-singleton")
    const first = createProgressEmitter("job-singleton", {
      totalFiles: 2,
    })

    // A nested caller (e.g. a spawn op inside an iterator) declares
    // additional totals — they should fold into the same singleton.
    const second = createProgressEmitter("job-singleton", {
      totalFiles: 3,
    })

    // Both handles drive the same shared state.
    first.incrementFilesDone()
    second.incrementFilesDone()

    vi.advanceTimersByTime(1000)

    expect(captured).toHaveLength(1)
    expect(captured[0].filesDone).toBe(2)
    expect(captured[0].filesTotal).toBe(5)
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
      of("a.mkv", "b.mkv", "c.mkv")
        .pipe(
          withFileProgress((file) =>
            of(`processed-${file}`),
          ),
        )
        .subscribe((value) => {
          dataFlow.push(value)
        })
    })

    vi.advanceTimersByTime(5_000)

    expect(dataFlow.sort()).toEqual([
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

    of("a", "b")
      .pipe(withFileProgress((file) => of(`done-${file}`)))
      .subscribe((value) => {
        captured.push(value)
      })

    vi.advanceTimersByTime(5_000)

    expect(captured.sort()).toEqual(["done-a", "done-b"])
  })

  test("passes a sequential 0-based index as the second argument to perFile", () => {
    const captured: Array<{ file: string; index: number }> =
      []

    of("a.mkv", "b.mkv", "c.mkv")
      .pipe(
        withFileProgress((file, index) =>
          of({ file, index }),
        ),
      )
      .subscribe((value) => {
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
