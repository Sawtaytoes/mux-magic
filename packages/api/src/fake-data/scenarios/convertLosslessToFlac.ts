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

type SkipReason = "audit-only" | "dsd" | "float-pcm"

type FakeFile = {
  path: string
  skipReason: SkipReason | null
}

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

// Mixed lossless inputs across the formats the command accepts plus a
// 32-bit-float WAV and a DSD source. The float/DSD entries surface the
// new probe-skip behavior in the JobCard's Results disclosure so the
// converted/skipped split can be eyeballed via fake-data.
const FAKE_FILES: readonly FakeFile[] = [
  { path: "Disc1/Track01.wav", skipReason: null },
  { path: "Disc1/Track02.aif", skipReason: null },
  {
    path: "Disc1/Track03-float.wav",
    skipReason: "float-pcm",
  },
  { path: "Disc2/Track01.m4a", skipReason: null },
  { path: "Disc2/Track02.dff", skipReason: "dsd" },
] as const

const swapExtensionToFlac = (filePath: string) =>
  filePath.replace(
    /\.(wav|wave|aif|aiff|m4a|m4b)$/iu,
    ".flac",
  )

const getEffectiveSkipReason = (
  file: FakeFile,
  isAuditOnly: boolean,
): SkipReason | null => {
  if (file.skipReason !== null) return file.skipReason
  if (isAuditOnly) return "audit-only"
  return null
}

const buildRecord = (
  file: FakeFile,
  isSourceDeleted: boolean,
  isAuditOnly: boolean,
) => {
  const effectiveSkipReason = getEffectiveSkipReason(
    file,
    isAuditOnly,
  )
  if (effectiveSkipReason !== null) {
    return {
      kind: "skipped" as const,
      reason: effectiveSkipReason,
      source: file.path,
    }
  }
  return {
    destination: swapExtensionToFlac(file.path),
    isSourceDeleted,
    kind: "converted" as const,
    source: file.path,
  }
}

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
  const isAuditOnly =
    typeof body === "object" &&
    body !== null &&
    "isAuditOnly" in body &&
    (body as { isAuditOnly?: unknown }).isAuditOnly === true

  const emitProgress = (
    ratio: number,
    activePaths: readonly string[],
  ) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    const filesDone = Math.round(ratio * FAKE_FILES.length)
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone,
      filesTotal: FAKE_FILES.length,
      currentFiles: activePaths.map((path) => ({
        path,
        ratio: ratio % 0.5 < 0.25 ? 0.4 : 0.75,
      })),
    })
  }

  const fakeFileSteps = FAKE_FILES.flatMap(
    (file, fileIndex) => {
      const flacPath = swapExtensionToFlac(file.path)
      const progressBefore =
        (fileIndex + 0.5) / FAKE_FILES.length
      const progressAfter =
        (fileIndex + 1) / FAKE_FILES.length
      const effectiveSkipReason = getEffectiveSkipReason(
        file,
        isAuditOnly,
      )
      return [
        effect(() => {
          if (effectiveSkipReason !== null) {
            logInfo(
              label,
              `SKIPPED FLAC SOURCE (${effectiveSkipReason}): ${file.path}`,
            )
          } else {
            logInfo(
              label,
              `Encoding ${file.path} → ${flacPath}`,
            )
          }
          emitProgress(progressBefore, [file.path])
        }),
        pause(effectiveSkipReason !== null ? 80 : 350),
        effect(() => {
          if (effectiveSkipReason === null) {
            logInfo(label, `  ✓ ${flacPath}`)
            if (isSourceDeleted) {
              logInfo(
                label,
                `  · removed source ${file.path}`,
              )
            }
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
        `Probing ${FAKE_FILES.length} lossless audio files.`,
      )
      const modeDescription = isAuditOnly
        ? "audit-only (dry-run; no ffmpeg, no writes)"
        : isSourceDeleted
          ? "encode + delete source"
          : "encode only (keep sources)"
      logInfo(label, `Mode: ${modeDescription}`)
      emitProgress(0, [])
    }),
    ...fakeFileSteps,
    effect(() => {
      const convertedCount = FAKE_FILES.filter(
        (file) =>
          getEffectiveSkipReason(file, isAuditOnly) ===
          null,
      ).length
      const skippedCount =
        FAKE_FILES.length - convertedCount
      logInfo(
        label,
        `Done. ${convertedCount} converted, ${skippedCount} skipped.`,
      )
      emitProgress(1.0, [])
    }),
    from(
      FAKE_FILES.map((file) =>
        buildRecord(file, isSourceDeleted, isAuditOnly),
      ) as unknown[],
    ),
  ) as Observable<unknown>
}
