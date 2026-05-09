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

// Two source files being compared against a reference. Each goes through:
//   Phase 1 — write 16-bit PCM WAV temp file (~1.5s, concurrent)
//   Phase 2 — cross-correlate audio signatures (~2s, sequential per pair)
const SOURCE_FILES = [
  "Episode01.mkv",
  "Episode02.mkv",
]
const REF_FILE = "Reference.mkv"

export const getAudioOffsetsScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label = options.label ?? "fake/getAudioOffsets"

  const emitProgress = (
    ratio: number,
    activePaths: string[],
    fileRatios: number[],
  ) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone: Math.round(ratio * SOURCE_FILES.length),
      filesTotal: SOURCE_FILES.length,
      currentFiles: activePaths.map((path, i) => ({
        path,
        ratio: fileRatios[i] ?? 0,
      })),
    })
  }

  return concat(
    effect(() => {
      logInfo(label, `Starting fake getAudioOffsets run.`)
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(label, `Reference: ${REF_FILE}`)
      logInfo(label, `Sources: ${SOURCE_FILES.join(", ")}`)
      emitProgress(0, [], [])
    }),

    // Phase 1 — Write PCM WAV files (both concurrently)
    effect(() => {
      logInfo(label, `Phase 1/2: Demuxing audio → 16-bit PCM WAV…`)
      logInfo(label, `  Writing ${REF_FILE} → /tmp/ref.wav`)
      logInfo(label, `  Writing ${SOURCE_FILES[0]} → /tmp/src_01.wav`)
      logInfo(label, `  Writing ${SOURCE_FILES[1]} → /tmp/src_02.wav`)
      emitProgress(0.05, [SOURCE_FILES[0], SOURCE_FILES[1]], [0.05, 0.05])
    }),
    pause(350),
    effect(() => { emitProgress(0.12, [SOURCE_FILES[0], SOURCE_FILES[1]], [0.25, 0.18]) }),
    pause(350),
    effect(() => { emitProgress(0.2, [SOURCE_FILES[0], SOURCE_FILES[1]], [0.45, 0.38]) }),
    pause(350),
    effect(() => { emitProgress(0.28, [SOURCE_FILES[0], SOURCE_FILES[1]], [0.65, 0.55]) }),
    pause(350),
    effect(() => { emitProgress(0.36, [SOURCE_FILES[0], SOURCE_FILES[1]], [0.85, 0.72]) }),
    pause(300),
    effect(() => {
      logInfo(label, `  ✓ All WAV files written.`)
      emitProgress(0.42, [], [])
    }),

    // Phase 2 — Cross-correlate signatures (sequential: one file at a time)
    effect(() => {
      logInfo(label, `Phase 2/2: Cross-correlating audio signatures…`)
      logInfo(label, `  Comparing ref.wav vs src_01.wav…`)
      emitProgress(0.45, [SOURCE_FILES[0]], [0.1])
    }),
    pause(400),
    effect(() => { emitProgress(0.55, [SOURCE_FILES[0]], [0.5]) }),
    pause(400),
    effect(() => {
      logInfo(label, `  → ${SOURCE_FILES[0]}: offset +150ms (confidence 0.94)`)
      emitProgress(0.65, [SOURCE_FILES[0]], [1.0])
    }),
    of<unknown>([{ offsetInMilliseconds: 150 }]),
    pause(250),
    effect(() => {
      logInfo(label, `  Comparing ref.wav vs src_02.wav…`)
      emitProgress(0.7, [SOURCE_FILES[1]], [0.1])
    }),
    pause(400),
    effect(() => { emitProgress(0.82, [SOURCE_FILES[1]], [0.55]) }),
    pause(400),
    effect(() => {
      logInfo(label, `  → ${SOURCE_FILES[1]}: offset 0ms (confidence 0.99)`)
      logInfo(label, `Done. Cleaning up temp WAV files.`)
      emitProgress(1.0, [], [])
    }),
    of<unknown>([{ offsetInMilliseconds: 0 }]),
  ) as Observable<unknown>
}
