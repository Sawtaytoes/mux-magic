import {
  finalize,
  ignoreElements,
  mergeMap,
  Observable,
  type OperatorFunction,
  Subject,
  type Subscriber,
  type Subscription,
  tap,
} from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"

// ---------------------------------------------------------------------------
// Process-wide Task scheduler
//
// A "Task" is a unit of heavy work (per-file copy, ffmpeg invocation, etc.)
// that's part of a Job. Tasks compete for a fixed pool of `concurrency`
// slots under TWO coupled constraints:
//   1. inflight-global < MAX_THREADS (unchanged from original design)
//   2. inflight-for-job < job.claim  (new — per-job quota)
//
// The per-job claim is registered before a job's tasks are enqueued via
// `registerJobClaim(jobId, claim)` and torn down via `unregisterJobClaim`
// once the job finishes. Tasks without a jobId (null) are gated only by
// the global cap.
//
// Wiring: a single inbox Subject carries `{ bridge$, jobId }` pairs through
// a custom scheduler operator. Each `runTask(work$)` pushes a gated inner
// Observable onto the inbox; when the operator grants a slot (both constraints
// satisfied), it subscribes to bridge$ which then starts work$ and forwards
// values to the caller. Slot is held for as long as the bridge$ subscription
// is alive, then released on complete/error or on caller unsubscribe.
//
// Fair scheduling: when the front of the queue can't be admitted (per-job
// cap full), the operator scans forward to find any task from a different
// job that can run — preventing one job's saturated claim from blocking
// other jobs' tasks.
//
// Composition rule: operators that already route through `runTask` /
// `runTasks` MUST NOT be nested inside another finite-concurrency
// `mergeMap(..., n)` operating over scheduled work. Use unbounded
// `mergeAll()` upstream and let the scheduler do the bounding.
// ---------------------------------------------------------------------------

type ScheduledTask = {
  bridge$: Observable<never>
  jobId: string | null
}

let concurrency: number | null = null
let inbox: Subject<ScheduledTask> | null = null

// Per-job thread claim registry — populated by registerJobClaim /
// unregisterJobClaim outside the scheduler operator so callers can
// register before enqueueing tasks.
const claimByJob = new Map<string, number>()

const ensureInbox = (): Subject<ScheduledTask> => {
  if (inbox === null) {
    throw new Error(
      "Task scheduler not initialized. Call initTaskScheduler() at process startup.",
    )
  }

  return inbox
}

// Custom scheduler operator: replaces the former `mergeAll(concurrency)`.
// Enforces the global cap AND the per-job claim on every admission decision.
const buildScheduler =
  (
    maxConcurrency: number,
  ): ((
    source: Observable<ScheduledTask>,
  ) => Observable<never>) =>
  (source$) =>
    new Observable<never>((outerSub) => {
      let inflight = 0
      const inflightByJob = new Map<string, number>()
      const queue: ScheduledTask[] = []

      const canAdmit = ({
        jobId,
      }: ScheduledTask): boolean => {
        if (inflight >= maxConcurrency) return false
        if (jobId === null) return true
        const claim =
          claimByJob.get(jobId) ?? maxConcurrency
        return (inflightByJob.get(jobId) ?? 0) < claim
      }

      const onComplete = (jobId: string | null): void => {
        inflight -= 1
        if (jobId !== null) {
          const count = (inflightByJob.get(jobId) ?? 0) - 1
          if (count <= 0) {
            inflightByJob.delete(jobId)
          } else {
            inflightByJob.set(jobId, count)
          }
        }
        admitFromQueue()
      }

      const admit = (index: number): void => {
        const task = queue.splice(index, 1)[0]
        if (!task) return
        inflight += 1
        if (task.jobId !== null) {
          inflightByJob.set(
            task.jobId,
            (inflightByJob.get(task.jobId) ?? 0) + 1,
          )
        }
        task.bridge$.subscribe({
          complete: () => onComplete(task.jobId),
          error: () => onComplete(task.jobId),
        })
      }

      const admitFromQueue = (): void => {
        // Loop: each admit() removes one task from the queue and may open
        // room for another (e.g. a per-job cap was the constraint, not the
        // global cap). Stop when no admissible task remains.
        while (true) {
          const index = queue.findIndex(canAdmit)
          if (index < 0) break
          admit(index)
        }
      }

      const subscription = source$.subscribe({
        next: (task) => {
          queue.push(task)
          admitFromQueue()
        },
        error: (error) => outerSub.error(error),
        complete: () => outerSub.complete(),
      })

      return () => subscription.unsubscribe()
    })

// Registers a per-job thread-count claim. Call this before enqueueing
// any tasks for the job; the scheduler reads the claim at admission time.
// If the jobId already has a claim, the new value overwrites it.
export const registerJobClaim = (
  jobId: string,
  claim: number,
): void => {
  claimByJob.set(jobId, claim)
}

// Removes the per-job claim after the job finishes. Safe to call even
// if the job had no registered claim (no-op).
export const unregisterJobClaim = (jobId: string): void => {
  claimByJob.delete(jobId)
}

// Init once at process startup. CLI passes 1 (sequential, equivalent to
// the historical concatMap behavior). API passes Number(MAX_THREADS) ||
// cpus().length. Idempotent on repeat calls with the same value; throws
// on conflicting re-init so a stray import path doesn't silently
// downgrade concurrency.
export const initTaskScheduler = (
  newConcurrency: number,
): void => {
  if (
    concurrency !== null &&
    concurrency === newConcurrency
  ) {
    return
  }

  if (concurrency !== null) {
    throw new Error(
      `Task scheduler already initialized at concurrency=${concurrency}; refusing to re-init at ${newConcurrency}`,
    )
  }

  concurrency = newConcurrency

  const newInbox = new Subject<ScheduledTask>()

  newInbox.pipe(buildScheduler(newConcurrency)).subscribe()

  inbox = newInbox
}

// Wraps work$ as a Task. The returned Observable is cold — subscribing
// enqueues the work; unsubscribing releases the slot (whether queued or
// running). Values from work$ mirror through to the caller. If work$
// errors, the caller sees the error.
//
// explicitJobId — pass a string or null in tests to bypass the async
// context lookup. Omit in production; the scheduler reads the current
// job id from the AsyncLocalStorage set by withJobContext() at subscribe
// time (inside the Observable factory), so the context is always live.
export const runTask = <T>(
  work$: Observable<T>,
  explicitJobId?: string | null,
): Observable<T> =>
  new Observable<T>((subscriber) => {
    const jobId =
      explicitJobId !== undefined
        ? explicitJobId
        : (getActiveJobId() ?? null)
    const queue = ensureInbox()

    let isCancelled = false
    let bridgeSubscriber: Subscriber<never> | null = null
    let innerSubscription: Subscription | null = null

    // Gated inner Observable. The scheduler subscribes to this when
    // a slot opens; we then start work$ and forward values to the caller.
    // Slot stays held for as long as this Observable is "alive" — it
    // completes when work$ ends naturally OR when the caller unsubscribes.
    const bridge$ = new Observable<never>((bridgeSub) => {
      if (isCancelled) {
        bridgeSub.complete()

        return
      }

      bridgeSubscriber = bridgeSub

      innerSubscription = work$.subscribe({
        next: (value) => {
          subscriber.next(value)
        },
        error: (error) => {
          subscriber.error(error)

          bridgeSub.complete()
        },
        complete: () => {
          subscriber.complete()

          bridgeSub.complete()
        },
      })

      return () => {
        innerSubscription?.unsubscribe()
      }
    })

    queue.next({ bridge$, jobId })

    return () => {
      isCancelled = true

      innerSubscription?.unsubscribe()

      // If the bridge has already been picked up by the scheduler,
      // explicitly complete it so the slot is freed. If still queued,
      // bridgeSubscriber is null and the isCancelled flag short-circuits
      // when its slot eventually opens.
      bridgeSubscriber?.complete()
    }
  })

// Pipeable form. Each upstream emission becomes a Task. Equivalent to
// `mergeMap(value => runTask(project(value, index)))` with unbounded
// outer concurrency — the scheduler is the actual cap.
export const runTasks = <T, R>(
  project: (value: T, index: number) => Observable<R>,
): OperatorFunction<T, R> =>
  mergeMap((value: T, index: number) =>
    runTask(project(value, index)),
  )

// Pipeable form preserving input order on output. Each upstream value
// is projected via mergeMap (parallel by default), but emissions are
// released downstream in input-index order — file 5 is held back until
// files 1-4 have emitted, even if file 5 finishes first.
//
// Does NOT route the projected work through `runTask`. Use this when
// the heavy work is already wrapped (e.g. the projector body uses
// `runTasks(...)` over a sub-stream), or when the iteration is plain
// orchestration that shouldn't compete for scheduler slots — e.g.
// iterating over a `groupBy`'s GroupedObservables when each group's
// inner per-file work is what actually does IO.
//
// Why "not via runTask": if both the outer iteration AND the inner
// per-element work occupy scheduler slots, MAX_THREADS outer slots
// can starve inner work (deadlock). Keep one layer scheduled.
//
// Memory: out-of-order results buffer in a Map keyed by index until
// the head-of-queue completes. For commands that emit thousands of
// large values per element, the buffer grows with the slowest-element
// lag — fine for the per-file summary use case (one or a few small
// values per element); revisit if a future caller streams large
// payloads.
export const mergeMapOrdered =
  <T, R>(
    project: (value: T, index: number) => Observable<R>,
  ): OperatorFunction<T, R> =>
  (source) =>
    new Observable<R>((subscriber) => {
      let nextEmitIndex = 0
      const buffered = new Map<number, R[]>()
      const completed = new Set<number>()
      let isUpstreamComplete = false
      let inflightCount = 0

      // Releases buffered results downstream in input-index order. Walks
      // forward from `nextEmitIndex` while the next slot is marked
      // completed; stops at the first gap. Called on every inner
      // completion AND on upstream complete.
      const tryFlush = (): void => {
        while (completed.has(nextEmitIndex)) {
          const items = buffered.get(nextEmitIndex) ?? []
          items.forEach((item) => {
            subscriber.next(item)
          })
          buffered.delete(nextEmitIndex)
          completed.delete(nextEmitIndex)
          nextEmitIndex += 1
        }

        if (isUpstreamComplete && inflightCount === 0) {
          subscriber.complete()
        }
      }

      const upstreamSubscription = source
        .pipe(
          mergeMap((value: T, index: number) => {
            inflightCount += 1

            return project(value, index).pipe(
              tap((result) => {
                const arr = buffered.get(index) ?? []
                arr.push(result)
                buffered.set(index, arr)
              }),
              finalize(() => {
                inflightCount -= 1
                completed.add(index)
                tryFlush()
              }),
              // Values were already captured by the tap above; suppress
              // them here so the outer mergeMap doesn't re-emit them
              // out of order.
              ignoreElements(),
            )
          }),
        )
        .subscribe({
          error: (error) => {
            subscriber.error(error)
          },
          complete: () => {
            isUpstreamComplete = true
            tryFlush()
          },
        })

      return () => {
        upstreamSubscription.unsubscribe()
      }
    })

// Pipeable form: each upstream value runs as a Task in parallel
// (capped by the scheduler), with emissions released in input-index
// order. Thin wrapper over `mergeMapOrdered` that wraps the projector
// in `runTask` for callers whose per-element work is the unit of
// scheduled IO/CPU (e.g. one network call + processing per file).
//
// Do NOT use this as the OUTER operator over a stream whose inner
// work also goes through the scheduler — both layers would compete
// for the same MAX_THREADS pool and risk deadlock. Use plain
// `mergeMapOrdered` for such orchestration and reserve the runTask
// wrapping for the deepest per-IO layer.
export const runTasksOrdered = <T, R>(
  project: (value: T, index: number) => Observable<R>,
): OperatorFunction<T, R> =>
  mergeMapOrdered((value: T, index: number) =>
    runTask(project(value, index)),
  )

// Test-only — reset singleton between vitest runs so tests can re-init at
// a different concurrency.
export const __resetTaskSchedulerForTests = (): void => {
  concurrency = null
  claimByJob.clear()

  inbox?.complete()

  inbox = null
}
