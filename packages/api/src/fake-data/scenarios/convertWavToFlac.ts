import { emitJobEvent } from "@mux-magic/core/src/api/jobStore.js"
import { getActiveJobId } from "@mux-magic/core/src/api/logCapture.js"
import { logInfo } from "@mux-magic/tools"
import {
  concat,
  from,
  ignoreElements,
  Observable,
  timer,
} from "rxjs"

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

const WAV_FILES = [
  "Disc1/Track01.wav",
  "Disc1/Track02.wav",
  "Disc1/Track03.wav",
  "Disc2/Track01.wav",
] as const

const swapExtensionToFlac = (filePath: string) =>
  filePath.replace(/\.wav$/u, ".flac")

export const convertWavToFlacScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label = options.label ?? "fake/convertWavToFlac"
  const isSourceDeleted =
    typeof body === "object" &&
    body !== null &&
    "isSourceDeleted" in body &&
    (body as { isSourceDeleted?: unknown })
      .isSourceDeleted === true

  const emitProgress = (
    ratio: number,
    activePaths: readonly string[],
  ) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    const filesDone = Math.round(ratio * WAV_FILES.length)
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone,
      filesTotal: WAV_FILES.length,
      currentFiles: activePaths.map((path) => ({
        path,
        ratio: ratio % 0.5 < 0.25 ? 0.4 : 0.75,
      })),
    })
  }

  const fakeFileSteps = WAV_FILES.flatMap(
    (wavPath, fileIndex) => {
      const flacPath = swapExtensionToFlac(wavPath)
      const progressBefore =
        (fileIndex + 0.5) / WAV_FILES.length
      const progressAfter =
        (fileIndex + 1) / WAV_FILES.length
      return [
        effect(() => {
          logInfo(
            label,
            `Encoding ${wavPath} → ${flacPath}`,
          )
          emitProgress(progressBefore, [wavPath])
        }),
        pause(350),
        effect(() => {
          logInfo(label, `  ✓ ${flacPath}`)
          if (isSourceDeleted) {
            logInfo(label, `  · removed source ${wavPath}`)
          }
          emitProgress(progressAfter, [])
        }),
      ]
    },
  )

  return concat(
    effect(() => {
      logInfo(label, `Starting fake convertWavToFlac run.`)
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Found ${WAV_FILES.length} .wav files to encode.`,
      )
      logInfo(
        label,
        `Mode: ${isSourceDeleted ? "encode + delete source" : "encode only (keep .wav)"}`,
      )
      emitProgress(0, [])
    }),
    ...fakeFileSteps,
    effect(() => {
      logInfo(
        label,
        `Done. Encoded ${WAV_FILES.length} .wav files to FLAC.`,
      )
      emitProgress(1.0, [])
    }),
    from(
      WAV_FILES.map((wavPath) => ({
        source: wavPath,
        destination: swapExtensionToFlac(wavPath),
      })) as unknown[],
    ),
  ) as Observable<unknown>
}
