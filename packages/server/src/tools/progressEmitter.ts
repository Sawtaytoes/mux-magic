import {
  concatMap,
  from,
  mergeMap,
  type Observable,
  type OperatorFunction,
  finalize as rxFinalize,
  toArray,
} from "rxjs"

import { emitJobEvent } from "../api/jobStore.js"
import { getActiveJobId } from "../api/logCapture.js"
import type { ProgressEvent } from "../api/types.js"
import { runTask } from "./taskScheduler.js"

// Hard cap on emission frequency. The user-facing requirement is "max
// of 1s between updates"; the deferred-first-emit behavior gives the
// "small jobs don't bother" property automatically — if the whole job
// completes inside this window, no event is ever emitted.
const THROTTLE_INTERVAL_MS = 1000

type EmitterPayload = Omit<ProgressEvent, "type">

type ProgressEmitterOptions = {
  totalFiles?: number
  totalBytes?: number
}

// Per-active-file state held inside the emitter. Keyed by an internal
// trackerId (not path) so the same path being processed twice (retry,
// concurrent passes) doesn't conflict.
type FileState = {
  path: string
  totalBytes: number | undefined
  bytesWritten: number
  explicitRatio: number | null | undefined
}

// Handle returned by emitter.startFile() — scoped to ONE in-flight file.
// Lets concurrent per-file Tasks each report their own bytes/ratio
// without stepping on each other. The emitter aggregates across all
// active trackers when computing snapshots.
export type FileTracker = {
  // Folds an incremental byte count from the inner copy/spawn pipeline.
  // Number is added to this file's counter; the emitter recomputes the
  // overall byte ratio.
  reportBytes: (bytesThisChunk: number) => void
  // Direct override of THIS file's ratio — used by spawn ops (mkvmerge,
  // mkvextract, ffmpeg) that report a percentage parsed from stdout
  // rather than byte counts.
  setRatio: (ratio: number | null) => void
  // Marks this file done. Folds its size into the cumulative byte tally
  // (caller-supplied takes precedence; falls back to whatever was
  // accumulated via reportBytes), increments filesDone, and removes the
  // tracker from the emitter's active-file set.
  finish: (fileSizeBytes?: number) => void
}

export type ProgressEmitter = {
  // Per-file iterator entry point. Returns a FileTracker scoped to the
  // file at `path`. Multiple trackers can be live simultaneously when
  // the caller is parallelizing per-file work. Adds the file to
  // `currentFiles` snapshots so the UI can show one row per in-flight
  // operation.
  startFile: (
    path: string,
    fileSizeBytes?: number,
  ) => FileTracker
  // Rollup-only counter bump. Increments filesDone (and folds bytes
  // into the cumulative tally if supplied) WITHOUT adding anything to
  // `currentFiles`. Used by generic iterators where the per-file unit
  // is opaque (the operator doesn't know the file path / size).
  incrementFilesDone: (fileSizeBytes?: number) => void
  // Direct ratio update — overrides the byte/file-derived overall
  // ratio. Useful when the caller has computed the canonical job
  // ratio itself.
  setRatio: (ratio: number | null) => void
  // Cancels any pending throttled emission. Does NOT emit a final
  // 100% — the job's natural status flip to `completed` is enough
  // signal for the UI to clear the bar. Always safe to call from
  // RxJS finalize() / catchError() / cancellation paths.
  finalize: () => void
}

type EmitterState = {
  jobId: string
  totalFiles: number | undefined
  totalBytes: number | undefined
  filesDone: number
  cumulativeBytes: number
  explicitRatio: number | null | undefined
  activeFiles: Map<number, FileState>
  nextTrackerId: number
  lastEmitAt: number | null
  pendingTimer: ReturnType<typeof setTimeout> | null
  pendingPayload: EmitterPayload | null
}

// Module-level singleton map — one EmitterState per jobId. Multiple
// callers (the iterator's withFileProgress, individual spawn ops nested
// inside per-file Tasks) all share the same state for a given jobId so
// the snapshot of "currently active files" is unified across the job.
const states = new Map<string, EmitterState>()

const computeRatio = (
  state: EmitterState,
): number | null => {
  if (state.explicitRatio !== undefined) {
    return state.explicitRatio
  }

  if (
    state.totalBytes !== undefined &&
    state.totalBytes > 0
  ) {
    const bytesInFlight = Array.from(
      state.activeFiles.values(),
    ).reduce((sum, file) => sum + file.bytesWritten, 0)

    return (
      (state.cumulativeBytes + bytesInFlight) /
      state.totalBytes
    )
  }

  if (
    state.totalFiles !== undefined &&
    state.totalFiles > 0
  ) {
    return state.filesDone / state.totalFiles
  }

  return null
}

const computeFileRatio = (
  file: FileState,
): number | null => {
  if (file.explicitRatio !== undefined) {
    return file.explicitRatio
  }

  if (
    file.totalBytes !== undefined &&
    file.totalBytes > 0
  ) {
    return file.bytesWritten / file.totalBytes
  }

  return null
}

type CurrentFilesEntry = {
  path: string
  ratio: number | null
}

const computeCurrentFiles = (
  state: EmitterState,
): CurrentFilesEntry[] =>
  Array.from(state.activeFiles.values()).map((file) => ({
    path: file.path,
    ratio: computeFileRatio(file),
  }))

// Compose the payload from accumulated state. Single source of truth so
// the throttle layer can capture a snapshot at any tick.
const snapshot = (state: EmitterState): EmitterPayload => {
  const payload: EmitterPayload = {
    ratio: computeRatio(state),
  }

  if (state.totalFiles !== undefined) {
    payload.filesDone = state.filesDone
    payload.filesTotal = state.totalFiles
  }

  const currentFiles = computeCurrentFiles(state)
  if (currentFiles.length > 0) {
    payload.currentFiles = currentFiles
  }

  return payload
}

const flush = (state: EmitterState): void => {
  if (state.pendingPayload === null) {
    return
  }

  emitJobEvent(state.jobId, {
    type: "progress",
    ...state.pendingPayload,
  })

  state.lastEmitAt = Date.now()
  state.pendingPayload = null
}

const scheduleEmit = (
  state: EmitterState,
  delayMs: number,
): void => {
  if (state.pendingTimer !== null) {
    return
  }

  state.pendingTimer = setTimeout(() => {
    state.pendingTimer = null
    flush(state)
  }, delayMs)
}

// Capture the current accumulated state and route it through the
// throttle gate. First call defers a full interval; later calls
// either flush immediately (if past the window) or hold the latest
// payload until the timer fires.
const tick = (state: EmitterState): void => {
  state.pendingPayload = snapshot(state)

  const now = Date.now()
  if (state.lastEmitAt === null) {
    scheduleEmit(state, THROTTLE_INTERVAL_MS)
    return
  }

  const sinceLastEmit = now - state.lastEmitAt
  if (sinceLastEmit >= THROTTLE_INTERVAL_MS) {
    if (state.pendingTimer !== null) {
      clearTimeout(state.pendingTimer)
      state.pendingTimer = null
    }
    flush(state)
    return
  }

  scheduleEmit(state, THROTTLE_INTERVAL_MS - sinceLastEmit)
}

// Returns the singleton emitter handle for the given jobId. The first
// call seeds totals; subsequent calls additively merge new totals (so a
// nested spawn op declaring extra totalBytes contributes to the same
// rollup the iterator started). The returned handle is a thin facade
// over the shared state — multiple call sites coexist safely.
export const createProgressEmitter = (
  jobId: string,
  options: ProgressEmitterOptions = {},
): ProgressEmitter => {
  const existingState = states.get(jobId)
  const state: EmitterState = existingState ?? {
    jobId,
    totalFiles: undefined,
    totalBytes: undefined,
    filesDone: 0,
    cumulativeBytes: 0,
    explicitRatio: undefined,
    activeFiles: new Map(),
    nextTrackerId: 0,
    lastEmitAt: null,
    pendingTimer: null,
    pendingPayload: null,
  }

  if (existingState === undefined) {
    states.set(jobId, state)
  }

  if (options.totalFiles !== undefined) {
    state.totalFiles =
      (state.totalFiles ?? 0) + options.totalFiles
  }

  if (options.totalBytes !== undefined) {
    state.totalBytes =
      (state.totalBytes ?? 0) + options.totalBytes
  }

  return {
    startFile: (path, fileSizeBytes) => {
      const trackerId = state.nextTrackerId
      state.nextTrackerId += 1

      const fileState: FileState = {
        path,
        totalBytes: fileSizeBytes,
        bytesWritten: 0,
        explicitRatio: undefined,
      }

      state.activeFiles.set(trackerId, fileState)
      tick(state)

      return {
        reportBytes: (bytesThisChunk) => {
          fileState.bytesWritten += bytesThisChunk
          tick(state)
        },
        setRatio: (ratio) => {
          fileState.explicitRatio = ratio
          tick(state)
        },
        finish: (fileSizeBytesOverride) => {
          // Idempotent — callers that wire finish() into both an exit
          // handler AND a teardown function (e.g. runFfmpeg) can fire
          // twice without double-folding bytes.
          if (!state.activeFiles.has(trackerId)) {
            return
          }

          state.cumulativeBytes +=
            fileSizeBytesOverride ??
            fileState.totalBytes ??
            fileState.bytesWritten
          // filesDone is NOT incremented here — only emitter.incrementFilesDone()
          // does that. tracker.finish() only manages the currentFiles display.
          // Callers inside withFileProgress get their filesDone count from the
          // rxFinalize(() => emitter.incrementFilesDone()) wired by that operator.
          state.activeFiles.delete(trackerId)
          tick(state)
        },
      }
    },
    incrementFilesDone: (fileSizeBytes) => {
      if (fileSizeBytes !== undefined) {
        state.cumulativeBytes += fileSizeBytes
      }
      state.filesDone += 1
      tick(state)
    },
    setRatio: (ratio) => {
      state.explicitRatio = ratio
      tick(state)
    },
    finalize: () => {
      if (state.pendingTimer !== null) {
        clearTimeout(state.pendingTimer)
        state.pendingTimer = null
      }
      state.pendingPayload = null
    },
  }
}

// Test/lifecycle helper — drops the emitter state for a given jobId.
// Called from jobStore.resetStore() so vitest's afterEach hook clears
// state cleanly. Safe to call when no state exists.
export const disposeProgressEmitter = (
  jobId: string,
): void => {
  const state = states.get(jobId)
  if (state === undefined) {
    return
  }

  if (state.pendingTimer !== null) {
    clearTimeout(state.pendingTimer)
  }

  states.delete(jobId)
}

export const __resetAllProgressEmittersForTests =
  (): void => {
    states.forEach((state) => {
      if (state.pendingTimer !== null) {
        clearTimeout(state.pendingTimer)
      }
    })
    states.clear()
  }

type WithFileProgressOptions = {
  // Upper bound on per-file fan-out from this operator. The actual
  // parallelism is capped further by the global Task scheduler
  // (process-wide MAX_THREADS budget). Defaults to Infinity — let the
  // scheduler decide. Inner-observable completions tick the emitter
  // regardless of ordering, so filesDone increments correctly even
  // when files finish out of order.
  concurrency?: number
}

// Sugar for the per-file-iterator pattern that ~all app-commands share:
// `getFiles(...).pipe(concatMap(fileInfo => …))`. Materializes the
// upstream into an array first (so totalFiles is known), then re-emits
// through `mergeMap(perFile, concurrency)` (defaults to Infinity — the
// scheduler is the actual cap) while ticking the emitter on each
// inner-observable completion. Wires `emitter.finalize()` into the
// pipeline's `finalize` operator so cancellation/error paths clear
// pending timers without the call site having to remember.
//
// The job id is pulled from the active AsyncLocalStorage context (the
// same mechanism that routes log lines to the right job) so call sites
// don't need to thread it through their pure-business signatures.
// Returns a no-op-style operator if there's no active job context —
// e.g. when an app-command runs outside the API server (CLI direct
// invocation), in which case the emitter has no subject to publish to.
export const withFileProgress =
  <T, U>(
    perFile: (fileInfo: T, index: number) => Observable<U>,
    options: WithFileProgressOptions = {},
  ): OperatorFunction<T, U> =>
  (source) =>
    source.pipe(
      toArray(),
      concatMap((files) => {
        const concurrency = options.concurrency ?? Infinity
        const indexedFiles = files.map((file, index) => ({
          file,
          index,
        }))
        const jobId = getActiveJobId()
        if (jobId === undefined) {
          return from(indexedFiles).pipe(
            mergeMap(
              ({ file, index }) =>
                runTask(perFile(file, index)),
              concurrency,
            ),
          )
        }
        const emitter = createProgressEmitter(jobId, {
          totalFiles: files.length,
        })
        return from(indexedFiles).pipe(
          mergeMap(
            ({ file, index }) =>
              runTask(
                perFile(file, index).pipe(
                  rxFinalize(() =>
                    emitter.incrementFilesDone(),
                  ),
                ),
              ),
            concurrency,
          ),
          rxFinalize(() => emitter.finalize()),
        )
      }),
    )
