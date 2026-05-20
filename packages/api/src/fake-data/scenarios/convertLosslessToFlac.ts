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

// Mixed lossless inputs across the formats the command accepts —
// surfaces in the dry-run UI that the rename to "convertLossless..."
// isn't just a relabel but actually covers the broader extension set.
const LOSSLESS_FILES = [
  "Disc1/Track01.wav",
  "Disc1/Track02.aif",
  "Disc1/Track03.aiff",
  "Disc2/Track01.m4a",
] as const

const swapExtensionToFlac = (filePath: string) =>
  filePath.replace(
    /\.(wav|wave|aif|aiff|m4a|m4b)$/iu,
    ".flac",
  )

export const convertLosslessToFlacScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label =
    options.label ?? "fake/convertLosslessToFlac"
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
    const filesDone = Math.round(
      ratio * LOSSLESS_FILES.length,
    )
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone,
      filesTotal: LOSSLESS_FILES.length,
      currentFiles: activePaths.map((path) => ({
        path,
        ratio: ratio % 0.5 < 0.25 ? 0.4 : 0.75,
      })),
    })
  }

  const fakeFileSteps = LOSSLESS_FILES.flatMap(
    (sourcePath, fileIndex) => {
      const flacPath = swapExtensionToFlac(sourcePath)
      const progressBefore =
        (fileIndex + 0.5) / LOSSLESS_FILES.length
      const progressAfter =
        (fileIndex + 1) / LOSSLESS_FILES.length
      return [
        effect(() => {
          logInfo(
            label,
            `Encoding ${sourcePath} → ${flacPath}`,
          )
          emitProgress(progressBefore, [sourcePath])
        }),
        pause(350),
        effect(() => {
          logInfo(label, `  ✓ ${flacPath}`)
          if (isSourceDeleted) {
            logInfo(
              label,
              `  · removed source ${sourcePath}`,
            )
          }
          emitProgress(progressAfter, [])
        }),
      ]
    },
  )

  return concat(
    effect(() => {
      logInfo(
        label,
        `Starting fake convertLosslessToFlac run.`,
      )
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Found ${LOSSLESS_FILES.length} lossless audio files to encode.`,
      )
      logInfo(
        label,
        `Mode: ${isSourceDeleted ? "encode + delete source" : "encode only (keep sources)"}`,
      )
      emitProgress(0, [])
    }),
    ...fakeFileSteps,
    effect(() => {
      logInfo(
        label,
        `Done. Encoded ${LOSSLESS_FILES.length} lossless audio files to FLAC.`,
      )
      emitProgress(1.0, [])
    }),
    from(
      LOSSLESS_FILES.map((sourcePath) => ({
        source: sourcePath,
        destination: swapExtensionToFlac(sourcePath),
      })) as unknown[],
    ),
  ) as Observable<unknown>
}
