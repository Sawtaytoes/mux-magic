import {
  mergeAll,
  mergeMap,
  Observable,
  type OperatorFunction,
  Subject,
  type Subscriber,
  type Subscription,
} from "rxjs"

// ---------------------------------------------------------------------------
// Process-wide Task scheduler
//
// A "Task" is a unit of heavy work (per-file copy, ffmpeg invocation, etc.)
// that's part of a Job. Tasks compete for a fixed pool of `concurrency`
// slots. Jobs themselves are NOT scheduled — only Tasks are. This avoids
// the deadlock where N concurrent Jobs occupying all slots starve their
// own inner Tasks.
//
// Wiring: a single inbox Subject pipes through `mergeAll(concurrency)`
// and is subscribed once at init. Each `runTask(work$)` pushes a gated
// inner Observable onto the inbox; when the outer mergeAll grants a slot,
// the gated Observable subscribes to `work$` and forwards values to the
// caller. Slot is held for as long as the inner subscription is alive,
// then released on natural complete/error or on caller unsubscribe.
//
// Composition rule: operators that already route through `runTask` /
// `runTasks` MUST NOT be nested inside another finite-concurrency
// `mergeMap(..., n)` operating over scheduled work. Use unbounded
// `mergeAll()` upstream and let the scheduler do the bounding.
// ---------------------------------------------------------------------------

let concurrency: number | null = null
let inbox: Subject<Observable<unknown>> | null = null

const ensureInbox = (): Subject<Observable<unknown>> => {
  if (inbox === null) {
    throw new Error(
      "Task scheduler not initialized. Call initTaskScheduler() at process startup."
    )
  }

  return inbox
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
    concurrency !== null
    && concurrency === newConcurrency
  ) {
    return
  }

  if (concurrency !== null) {
    throw new Error(
      `Task scheduler already initialized at concurrency=${concurrency}; refusing to re-init at ${newConcurrency}`
    )
  }

  concurrency = newConcurrency

  const newInbox = (
    new Subject<Observable<unknown>>()
  )

  newInbox
  .pipe(
    mergeAll(
      newConcurrency
    ),
  )
  .subscribe()

  inbox = newInbox
}

// Wraps work$ as a Task. The returned Observable is cold — subscribing
// enqueues the work; unsubscribing releases the slot (whether queued or
// running). Values from work$ mirror through to the caller. If work$
// errors, the caller sees the error.
export const runTask = <T>(
  work$: Observable<T>,
): Observable<T> => (
  new Observable<T>((subscriber) => {
    const queue = ensureInbox()

    let isCancelled = false
    let bridgeSubscriber: Subscriber<never> | null = null
    let innerSubscription: Subscription | null = null

    // Gated inner Observable. The outer mergeAll subscribes to this when
    // a slot opens; we then start work$ and forward values to the caller.
    // Slot stays held for as long as this Observable is "alive" — it
    // completes when work$ ends naturally OR when the caller unsubscribes
    // (handled below).
    const bridge$ = (
      new Observable<never>((bridgeSub) => {
        if (isCancelled) {
          bridgeSub
          .complete()

          return
        }

        bridgeSubscriber = bridgeSub

        innerSubscription = (
          work$
          .subscribe({
            next: (value) => {
              subscriber
              .next(
                value
              )
            },
            error: (error) => {
              subscriber
              .error(
                error
              )

              bridgeSub
              .complete()
            },
            complete: () => {
              subscriber
              .complete()

              bridgeSub
              .complete()
            },
          })
        )

        return () => {
          innerSubscription
          ?.unsubscribe()
        }
      })
    )

    queue
    .next(
      bridge$
    )

    return () => {
      isCancelled = true

      innerSubscription
      ?.unsubscribe()

      // If the bridge has already been picked up by the outer mergeAll,
      // explicitly complete it so mergeAll frees the slot. If still
      // queued, bridgeSubscriber is null and the isCancelled flag
      // short-circuits when its slot eventually opens.
      bridgeSubscriber
      ?.complete()
    }
  })
)

// Pipeable form. Each upstream emission becomes a Task. Equivalent to
// `mergeMap(value => runTask(project(value, index)))` with unbounded
// outer concurrency — the scheduler is the actual cap.
export const runTasks = <T, R>(
  project: (value: T, index: number) => Observable<R>,
): OperatorFunction<T, R> => (
  mergeMap((value: T, index: number) => (
    runTask(
      project(
        value,
        index,
      )
    )
  ))
)

// Test-only — reset singleton between vitest runs so tests can re-init at
// a different concurrency.
export const __resetTaskSchedulerForTests = (): void => {
  concurrency = null

  inbox
  ?.complete()

  inbox = null
}
