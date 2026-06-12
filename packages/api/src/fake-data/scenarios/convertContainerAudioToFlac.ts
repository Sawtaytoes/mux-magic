import { emitJobEvent } from "@mux-magic/core/src/api/jobStore.js"
import { getActiveJobId } from "@mux-magic/core/src/api/logCapture.js"
import { logInfo, logWarning } from "@mux-magic/tools"
import {
  concat,
  from,
  ignoreElements,
  Observable,
  timer,
} from "rxjs"

type SkipReason = "no-audio" | "video-not-acknowledged"

type FakeFile = {
  audioCodec: string
  filePath: string
  hasVideoTrack: boolean
  skipReason: SkipReason | null
}

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

const swapExtensionToFlac = (filePath: string) =>
  filePath.replace(/\.[^.]+$/u, ".flac")

// Mixed inputs: audio-only FLAC-in-MKV (demux), AAC-in-MP4 (re-encode),
// and one music-video that is skipped unless isVideoDropAcknowledged is set.
const FAKE_FILES: readonly FakeFile[] = [
  {
    filePath: "Music/lossless-rip.mkv",
    audioCodec: "FLAC",
    hasVideoTrack: false,
    skipReason: null,
  },
  {
    filePath: "Music/aac-song.mp4",
    audioCodec: "AAC",
    hasVideoTrack: false,
    skipReason: null,
  },
  {
    filePath: "Music/music-video.mkv",
    audioCodec: "AAC",
    hasVideoTrack: true,
    skipReason: "video-not-acknowledged",
  },
] as const

const getEffectiveSkipReason = (
  file: FakeFile,
  isVideoDropAcknowledged: boolean,
): SkipReason | null => {
  if (file.skipReason === "video-not-acknowledged") {
    return isVideoDropAcknowledged
      ? null
      : "video-not-acknowledged"
  }
  return file.skipReason
}

type ConvertedRecord = {
  destination: string
  isSourceDeleted: boolean
  kind: "converted"
  source: string
}

const buildRecord = (
  file: FakeFile,
  isSourceDeleted: boolean,
  isVideoDropAcknowledged: boolean,
): ConvertedRecord | null => {
  const effectiveSkipReason = getEffectiveSkipReason(
    file,
    isVideoDropAcknowledged,
  )
  if (effectiveSkipReason !== null) return null
  return {
    destination: swapExtensionToFlac(file.filePath),
    isSourceDeleted,
    kind: "converted",
    source: file.filePath,
  }
}

export const convertContainerAudioToFlacScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label =
    options.label ?? "fake/convertContainerAudioToFlac"
  const isSourceDeleted =
    typeof body === "object" &&
    body !== null &&
    "isSourceDeleted" in body &&
    (body as { isSourceDeleted?: unknown })
      .isSourceDeleted === true
  const isVideoDropAcknowledged =
    typeof body === "object" &&
    body !== null &&
    "isVideoDropAcknowledged" in body &&
    (body as { isVideoDropAcknowledged?: unknown })
      .isVideoDropAcknowledged === true

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
      const flacPath = swapExtensionToFlac(file.filePath)
      const progressBefore =
        (fileIndex + 0.5) / FAKE_FILES.length
      const progressAfter =
        (fileIndex + 1) / FAKE_FILES.length
      const effectiveSkipReason = getEffectiveSkipReason(
        file,
        isVideoDropAcknowledged,
      )
      return [
        effect(() => {
          if (effectiveSkipReason !== null) {
            logWarning(
              label,
              `VIDEO PRESENT — skipping (set isVideoDropAcknowledged: true): ${file.filePath}`,
            )
          } else {
            const mode =
              file.audioCodec === "FLAC"
                ? "lossless demux (-c:a copy)"
                : `re-encode (-c:a flac from ${file.audioCodec})`
            logInfo(
              label,
              `Encoding ${file.filePath} → ${flacPath} [${mode}]`,
            )
          }
          emitProgress(progressBefore, [file.filePath])
        }),
        pause(effectiveSkipReason !== null ? 80 : 400),
        effect(() => {
          if (effectiveSkipReason === null) {
            logInfo(label, `  ✓ ${flacPath}`)
            if (isSourceDeleted) {
              logInfo(
                label,
                `  · removed source ${file.filePath}`,
              )
            }
          }
          emitProgress(progressAfter, [])
        }),
      ]
    },
  )

  const records = FAKE_FILES.map((file) =>
    buildRecord(
      file,
      isSourceDeleted,
      isVideoDropAcknowledged,
    ),
  ).filter(
    (record): record is ConvertedRecord => record !== null,
  )

  return concat(
    effect(() => {
      logInfo(
        label,
        `Starting fake convertContainerAudioToFlac run.`,
      )
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Probing ${FAKE_FILES.length} container-with-video files.`,
      )
      const modeDescription = isSourceDeleted
        ? "encode + delete source"
        : "encode only (keep sources)"
      logInfo(label, `Mode: ${modeDescription}`)
      if (!isVideoDropAcknowledged) {
        logInfo(
          label,
          "Note: files with video tracks will be skipped. Set isVideoDropAcknowledged: true to convert them.",
        )
      }
      emitProgress(0, [])
    }),
    ...fakeFileSteps,
    effect(() => {
      const convertedCount = records.length
      const skippedCount =
        FAKE_FILES.length - convertedCount
      logInfo(
        label,
        `Done. ${convertedCount} converted, ${skippedCount} skipped.`,
      )
      emitProgress(1.0, [])
    }),
    from(records as unknown[]),
  ) as Observable<unknown>
}
