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

type FakeFileResult = {
  audioCodec: string | null
  audioTrackCount: number
  filePath: string
  hasVideoTrack: boolean
  videoTrackCount: number
}

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

// Mixed container-with-video inputs: some audio-only (no video track),
// some with actual video tracks. Lets the UI exercise the hasVideoTrack
// differentiation in the results disclosure.
const FAKE_FILES: readonly FakeFileResult[] = [
  {
    filePath: "Music/song-ripped-from-mkv.mkv",
    audioTrackCount: 1,
    videoTrackCount: 0,
    hasVideoTrack: false,
    audioCodec: "FLAC",
  },
  {
    filePath: "Music/music-video.mp4",
    audioTrackCount: 1,
    videoTrackCount: 1,
    hasVideoTrack: true,
    audioCodec: "AAC",
  },
  {
    filePath: "Music/another-audio-container.mkv",
    audioTrackCount: 1,
    videoTrackCount: 0,
    hasVideoTrack: false,
    audioCodec: "Vorbis",
  },
  {
    filePath: "Music/video-only.mkv",
    audioTrackCount: 0,
    videoTrackCount: 1,
    hasVideoTrack: true,
    audioCodec: null,
  },
] as const

export const findContainerAudioFilesScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label =
    options.label ?? "fake/findContainerAudioFiles"

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
        ratio: 0.5,
      })),
    })
  }

  const fakeFileSteps = FAKE_FILES.flatMap(
    (file, fileIndex) => {
      const progressBefore =
        (fileIndex + 0.5) / FAKE_FILES.length
      const progressAfter =
        (fileIndex + 1) / FAKE_FILES.length
      return [
        effect(() => {
          logInfo(
            label,
            `Probing ${file.filePath} (${file.hasVideoTrack ? "has video track" : "audio-only"})`,
          )
          emitProgress(progressBefore, [file.filePath])
        }),
        pause(200),
        effect(() => {
          emitProgress(progressAfter, [])
        }),
      ]
    },
  )

  return concat(
    effect(() => {
      logInfo(
        label,
        `Starting fake findContainerAudioFiles run.`,
      )
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Probing ${FAKE_FILES.length} container-with-video files.`,
      )
      emitProgress(0, [])
    }),
    ...fakeFileSteps,
    effect(() => {
      const withVideoCount = FAKE_FILES.filter(
        (f) => f.hasVideoTrack,
      ).length
      const audioOnlyCount =
        FAKE_FILES.length - withVideoCount
      logInfo(
        label,
        `Done. ${audioOnlyCount} audio-only, ${withVideoCount} with video track.`,
      )
      emitProgress(1.0, [])
    }),
    from(FAKE_FILES as unknown as unknown[]),
  ) as Observable<unknown>
}
