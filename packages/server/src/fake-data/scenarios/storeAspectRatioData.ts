import { concat, ignoreElements, Observable, of, timer } from "rxjs"

import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"
import { logInfo } from "../../tools/logMessage.js"

const pause = (ms: number): Observable<never> => (
  timer(ms).pipe(ignoreElements()) as Observable<never>
)

const effect = (fn: () => void): Observable<never> => (
  new Observable<never>((sub) => { fn(); sub.complete() })
)

// 8 files, 4 processed concurrently (matching a typical server concurrency
// setting), each taking slightly different durations to feel realistic.
const FILES = [
  "Movie (2023)/Movie (2023).mkv",
  "Movie (2023)/Bonus Features/Making Of.mkv",
  "Movie (2023)/Bonus Features/Deleted Scenes.mkv",
  "TV Show S01/Episode 01.mkv",
  "TV Show S01/Episode 02.mkv",
  "TV Show S01/Episode 03.mkv",
  "TV Show S01/Episode 04.mkv",
  "TV Show S01/Episode 05.mkv",
]

export const storeAspectRatioDataScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label = options.label ?? "fake/storeAspectRatioData"

  const emitProgress = (ratio: number, active: Array<{ path: string; r: number }>) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone: Math.round(ratio * FILES.length),
      filesTotal: FILES.length,
      currentFiles: active.map(({ path, r }) => ({ path, ratio: r })),
    })
  }

  return concat(
    effect(() => {
      logInfo(label, `Starting fake storeAspectRatioData run.`)
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(label, `Scanning ${FILES.length} media files (concurrency: 4)…`)
      emitProgress(0, [])
    }),

    // Batch 1 — 4 concurrent reads
    effect(() => {
      logInfo(label, `Reading mediainfo for batch 1/2…`)
      emitProgress(0.05, [
        { path: FILES[0], r: 0.1 },
        { path: FILES[1], r: 0.1 },
        { path: FILES[2], r: 0.1 },
        { path: FILES[3], r: 0.1 },
      ])
    }),
    pause(280),
    effect(() => {
      emitProgress(0.15, [
        { path: FILES[0], r: 0.5 },
        { path: FILES[1], r: 0.35 },
        { path: FILES[2], r: 0.6 },
        { path: FILES[3], r: 0.4 },
      ])
    }),
    pause(280),
    effect(() => {
      logInfo(label, `  ✓ ${FILES[2]}: 2.39:1`)
      emitProgress(0.26, [
        { path: FILES[0], r: 0.8 },
        { path: FILES[1], r: 0.7 },
        { path: FILES[3], r: 0.75 },
      ])
    }),
    pause(220),
    effect(() => {
      logInfo(label, `  ✓ ${FILES[0]}: 2.39:1`)
      logInfo(label, `  ✓ ${FILES[1]}: 1.78:1`)
      logInfo(label, `  ✓ ${FILES[3]}: 1.78:1`)
      emitProgress(0.5, [])
    }),
    of<unknown>({ ok: true, filesProcessed: 4 }),

    // Batch 2 — remaining 4 concurrent reads
    effect(() => {
      logInfo(label, `Reading mediainfo for batch 2/2…`)
      emitProgress(0.55, [
        { path: FILES[4], r: 0.1 },
        { path: FILES[5], r: 0.1 },
        { path: FILES[6], r: 0.1 },
        { path: FILES[7], r: 0.1 },
      ])
    }),
    pause(280),
    effect(() => {
      emitProgress(0.65, [
        { path: FILES[4], r: 0.45 },
        { path: FILES[5], r: 0.6 },
        { path: FILES[6], r: 0.4 },
        { path: FILES[7], r: 0.55 },
      ])
    }),
    pause(280),
    effect(() => {
      logInfo(label, `  ✓ ${FILES[5]}: 1.78:1`)
      logInfo(label, `  ✓ ${FILES[7]}: 1.78:1`)
      emitProgress(0.8, [
        { path: FILES[4], r: 0.85 },
        { path: FILES[6], r: 0.9 },
      ])
    }),
    pause(200),
    effect(() => {
      logInfo(label, `  ✓ ${FILES[4]}: 1.78:1`)
      logInfo(label, `  ✓ ${FILES[6]}: 1.78:1`)
      logInfo(label, `Done. Stored aspect ratios for ${FILES.length} files.`)
      emitProgress(1.0, [])
    }),
    of<unknown>({ ok: true, filesProcessed: 4 }),
  ) as Observable<unknown>
}
