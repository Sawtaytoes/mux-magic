import { logInfo } from "@mux-magic/tools"
import {
  concat,
  from,
  ignoreElements,
  Observable,
  timer,
} from "rxjs"
import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

// Fake files: 6 FLACs processed in two batches of 3, showing parallel I/O.
const FILES = [
  "Disc1/Track01.flac",
  "Disc1/Track02.flac",
  "Disc1/Track03.flac",
  "Disc2/Track01.flac",
  "Disc2/Track02.flac",
  "Disc2/Track03.flac",
]

export const replaceFlacWithPcmAudioScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label =
    options.label ?? "fake/replaceFlacWithPcmAudio"

  const emitProgress = (
    ratio: number,
    activePaths: string[],
  ) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    const filesDone = Math.round(ratio * FILES.length)
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone,
      filesTotal: FILES.length,
      currentFiles: activePaths.map((path) => ({
        path,
        ratio: ratio % 0.5 < 0.25 ? 0.4 : 0.75,
      })),
    })
  }

  return concat(
    effect(() => {
      logInfo(
        label,
        `Starting fake replaceFlacWithPcmAudio run.`,
      )
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Found ${FILES.length} FLAC files to convert.`,
      )
      emitProgress(0, [])
    }),

    // Batch 1 — 3 files in parallel
    effect(() => {
      logInfo(
        label,
        `[1/2] Converting: ${FILES[0]}, ${FILES[1]}, ${FILES[2]}`,
      )
      emitProgress(0.05, FILES.slice(0, 3))
    }),
    pause(500),
    effect(() => {
      emitProgress(0.2, FILES.slice(0, 3))
    }),
    pause(500),
    effect(() => {
      emitProgress(0.35, FILES.slice(0, 3))
    }),
    pause(500),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[0]} → ${FILES[0].replace(".flac", ".wav")}`,
      )
      emitProgress(0.42, FILES.slice(1, 3))
    }),
    pause(300),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[1]} → ${FILES[1].replace(".flac", ".wav")}`,
      )
      emitProgress(0.48, FILES.slice(2, 3))
    }),
    pause(200),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[2]} → ${FILES[2].replace(".flac", ".wav")}`,
      )
      emitProgress(0.5, [])
    }),
    from([
      {
        source: FILES[0],
        destination: FILES[0].replace(".flac", ".wav"),
      },
      {
        source: FILES[1],
        destination: FILES[1].replace(".flac", ".wav"),
      },
      {
        source: FILES[2],
        destination: FILES[2].replace(".flac", ".wav"),
      },
    ] as unknown[]),

    // Batch 2 — 3 files in parallel
    effect(() => {
      logInfo(
        label,
        `[2/2] Converting: ${FILES[3]}, ${FILES[4]}, ${FILES[5]}`,
      )
      emitProgress(0.55, FILES.slice(3))
    }),
    pause(450),
    effect(() => {
      emitProgress(0.65, FILES.slice(3))
    }),
    pause(450),
    effect(() => {
      emitProgress(0.78, FILES.slice(3))
    }),
    pause(350),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[3]} → ${FILES[3].replace(".flac", ".wav")}`,
      )
      emitProgress(0.85, FILES.slice(4))
    }),
    pause(200),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[4]} → ${FILES[4].replace(".flac", ".wav")}`,
      )
      emitProgress(0.92, FILES.slice(5))
    }),
    pause(200),
    effect(() => {
      logInfo(
        label,
        `  ✓ ${FILES[5]} → ${FILES[5].replace(".flac", ".wav")}`,
      )
      logInfo(
        label,
        `Done. Converted 6 FLAC files to PCM WAV.`,
      )
      emitProgress(1.0, [])
    }),
    from([
      {
        source: FILES[3],
        destination: FILES[3].replace(".flac", ".wav"),
      },
      {
        source: FILES[4],
        destination: FILES[4].replace(".flac", ".wav"),
      },
      {
        source: FILES[5],
        destination: FILES[5].replace(".flac", ".wav"),
      },
    ] as unknown[]),
  ) as Observable<unknown>
}
