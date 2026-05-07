import {
  concatMap,
  finalize as rxFinalize,
  from,
  mergeMap,
  type Observable,
  type OperatorFunction,
  toArray,
} from "rxjs"

import { emitJobEvent } from "../api/jobStore.js"
import { getActiveJobId } from "../api/logCapture.js"
import type { ProgressEvent } from "../api/types.js"

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

export type ProgressEmitter = {
  // Per-file iterator entry point. Increments the internal filesDone
  // counter and (if a totalBytes was declared) folds the just-finished
  // file's size into the cumulative byte tally so future ratio
  // computations include it.
  finishFile: (fileSizeBytes?: number) => void
  // Marks the file currently being processed. Resets the in-file byte
  // counter; subsequent reportBytes calls accumulate against this file
  // until the next startFile or finishFile.
  startFile: (path: string, fileSizeBytes?: number) => void
  // Folds an incremental byte count from the inner copy/spawn pipeline.
  // Number is added to the in-file counter; currentFileRatio is
  // recomputed (currentFileBytesWritten / currentFileTotalBytes).
  reportBytes: (bytesThisChunk: number) => void
  // Direct override of currentFileRatio — used by spawn ops (mkvmerge,
  // mkvextract, ffmpeg) that report a percentage parsed from stdout
  // rather than byte counts. Resets back to byte-derived computation
  // on the next startFile / finishFile.
  setCurrentFileRatio: (ratio: number | null) => void
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

// Builds an emitter bound to a specific job id. Caller drives it from
// inside a per-file pipeline; the emitter handles throttling and the
// "trivial-fast jobs stay silent" rule:
//
//   - The first `update`-style call (finishFile / reportBytes / setRatio)
//     starts a 1s timer; nothing is emitted yet. If finalize() lands
//     before the timer fires, no progress event is ever written to the
//     subject — the running-status badge alone is the UX for fast jobs.
//   - Subsequent calls inside the throttle window collapse onto the
//     latest payload. When the timer fires, the latest snapshot is
//     pushed and a fresh 1s window starts.
//   - finalize() clears any pending timer. Idempotent.
export const createProgressEmitter = (
  jobId: string,
  options: ProgressEmitterOptions = {},
): ProgressEmitter => {
  const { totalFiles, totalBytes } = options

  let filesDone = 0
  let cumulativeBytes = 0
  let currentFile: string | undefined = undefined
  let currentFileTotalBytes: number | undefined = undefined
  let currentFileBytesWritten = 0
  let explicitRatio: number | null | undefined = undefined
  let explicitCurrentFileRatio: number | null | undefined = undefined

  let lastEmitAt: number | null = null
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPayload: EmitterPayload | null = null

  // Compose the payload from accumulated state. Single source of truth so
  // the throttle layer can capture a snapshot at any tick.
  const snapshot = (): EmitterPayload => {
    let ratio: number | null
    if (explicitRatio !== undefined) {
      ratio = explicitRatio
    } else if (totalBytes !== undefined && totalBytes > 0) {
      ratio = (cumulativeBytes + currentFileBytesWritten) / totalBytes
    } else if (totalFiles !== undefined && totalFiles > 0) {
      ratio = filesDone / totalFiles
    } else {
      ratio = null
    }

    const payload: EmitterPayload = { ratio }
    if (totalFiles !== undefined) {
      payload.filesDone = filesDone
      payload.filesTotal = totalFiles
    }
    if (currentFile !== undefined) {
      payload.currentFile = currentFile
      payload.currentFileRatio = (
        explicitCurrentFileRatio !== undefined
          ? explicitCurrentFileRatio
          : currentFileTotalBytes !== undefined && currentFileTotalBytes > 0
            ? currentFileBytesWritten / currentFileTotalBytes
            : null
      )
    }
    return payload
  }

  const flush = (): void => {
    if (pendingPayload === null) return
    emitJobEvent(jobId, { type: "progress", ...pendingPayload })
    lastEmitAt = Date.now()
    pendingPayload = null
  }

  const schedule = (delayMs: number): void => {
    if (pendingTimer !== null) return
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      flush()
    }, delayMs)
  }

  // Capture the current accumulated state and route it through the
  // throttle gate. First call defers a full interval; later calls
  // either flush immediately (if past the window) or hold the latest
  // payload until the timer fires.
  const tick = (): void => {
    pendingPayload = snapshot()

    const now = Date.now()
    if (lastEmitAt === null) {
      schedule(THROTTLE_INTERVAL_MS)
      return
    }

    const sinceLastEmit = now - lastEmitAt
    if (sinceLastEmit >= THROTTLE_INTERVAL_MS) {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      flush()
      return
    }

    schedule(THROTTLE_INTERVAL_MS - sinceLastEmit)
  }

  return {
    startFile: (path, fileSizeBytes) => {
      currentFile = path
      currentFileTotalBytes = fileSizeBytes
      currentFileBytesWritten = 0
      explicitCurrentFileRatio = undefined
      tick()
    },
    reportBytes: (bytesThisChunk) => {
      currentFileBytesWritten += bytesThisChunk
      tick()
    },
    finishFile: (fileSizeBytes) => {
      // Roll the just-finished file into the cumulative tally. Prefer
      // the caller-supplied fileSizeBytes (authoritative); fall back to
      // whatever we accumulated during reportBytes calls.
      cumulativeBytes += fileSizeBytes ?? currentFileBytesWritten
      filesDone += 1
      currentFile = undefined
      currentFileTotalBytes = undefined
      currentFileBytesWritten = 0
      explicitCurrentFileRatio = undefined
      tick()
    },
    setCurrentFileRatio: (ratio) => {
      explicitCurrentFileRatio = ratio
      tick()
    },
    setRatio: (ratio) => {
      explicitRatio = ratio
      tick()
    },
    finalize: () => {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      pendingPayload = null
    },
  }
}

type WithFileProgressOptions = {
  // Number of inner observables to run in parallel. Defaults to 1
  // (sequential, matching `concatMap`). Set higher (e.g. cpus().length)
  // to match an app-command's existing `mergeAll(threadCount)` flow.
  // Inner-observable completions tick the emitter regardless of
  // ordering — filesDone increments correctly even when files finish
  // out of order.
  concurrency?: number
}

// Sugar for the per-file-iterator pattern that ~all app-commands share:
// `getFiles(...).pipe(concatMap(fileInfo => …))`. Materializes the
// upstream into an array first (so totalFiles is known), then re-emits
// through `concatMap(perFile)` (or `mergeMap(perFile, concurrency)`
// when an opts.concurrency > 1 is supplied) while ticking the emitter
// on each inner-observable completion. Wires `emitter.finalize()` into
// the pipeline's `finalize` operator so cancellation/error paths clear
// pending timers without the call site having to remember.
//
// The job id is pulled from the active AsyncLocalStorage context (the
// same mechanism that routes log lines to the right job) so call sites
// don't need to thread it through their pure-business signatures.
// Returns a no-op-style operator if there's no active job context —
// e.g. when an app-command runs outside the API server (CLI direct
// invocation), in which case the emitter has no subject to publish to.
export const withFileProgress = <T, U>(
  perFile: (fileInfo: T, index: number) => Observable<U>,
  options: WithFileProgressOptions = {},
): OperatorFunction<T, U> => (source) => (
  source
  .pipe(
    toArray(),
    concatMap((files) => {
      const concurrency = options.concurrency ?? 1
      const indexedFiles = files.map((file, index) => ({ file, index }))
      const jobId = getActiveJobId()
      if (jobId === undefined) {
        return from(indexedFiles).pipe(
          mergeMap(({ file, index }) => perFile(file, index), concurrency),
        )
      }
      const emitter = createProgressEmitter(jobId, {
        totalFiles: files.length,
      })
      return from(indexedFiles).pipe(
        mergeMap(
          ({ file, index }) => (
            perFile(file, index)
            .pipe(
              rxFinalize(() => emitter.finishFile()),
            )
          ),
          concurrency,
        ),
        rxFinalize(() => emitter.finalize()),
      )
    }),
  )
)
