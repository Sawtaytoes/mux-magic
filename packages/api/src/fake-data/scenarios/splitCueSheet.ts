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

// Two synthetic albums × 3 tracks each, mirroring the CUE-SPLITS
// per-album layout. The Japanese title in album 2 verifies that the
// fake scenario doesn't break consumers that handle non-ASCII output.
const ALBUMS = [
  {
    folder: "Lossless/Greatest Hits",
    cuePath: "Lossless/Greatest Hits/album.cue",
    tracks: [
      { number: 1, title: "Opening" },
      { number: 2, title: "Second Track" },
      { number: 3, title: "Closing" },
    ],
  },
  {
    folder: "Lossless/残酷な天使のテーゼ",
    cuePath: "Lossless/残酷な天使のテーゼ/album.cue",
    tracks: [
      { number: 1, title: "残酷な天使のテーゼ" },
      { number: 2, title: "魂のルフラン" },
      { number: 3, title: "FLY ME TO THE MOON" },
    ],
  },
] as const

export const splitCueSheetScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label = options.label ?? "fake/splitCueSheet"
  const totalTracks = ALBUMS.reduce(
    (sum, album) => sum + album.tracks.length,
    0,
  )

  const emitProgress = (
    completed: number,
    activePaths: ReadonlyArray<string>,
  ) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    emitJobEvent(jobId, {
      type: "progress",
      ratio: completed / totalTracks,
      filesDone: completed,
      filesTotal: totalTracks,
      currentFiles: activePaths.map((path) => ({
        path,
        ratio: 0.5,
      })),
    })
  }

  const records = ALBUMS.flatMap((album) =>
    album.tracks.map((track) => {
      const destination = `CUE-SPLITS/${album.folder.split(
        "/",
      ).slice(-1)[0]}/${String(track.number).padStart(
        2,
        "0",
      )} - ${track.title}.flac`
      return {
        source: album.cuePath,
        destination,
        trackNumber: track.number,
        title: track.title,
      }
    }),
  )

  return concat(
    effect(() => {
      logInfo(
        label,
        `Starting fake splitCueSheet run.`,
      )
      logInfo(label, `Body: ${JSON.stringify(body)}`)
      logInfo(
        label,
        `Found ${ALBUMS.length} albums with CUE sheets (${totalTracks} tracks total).`,
      )
      emitProgress(0, [])
    }),
    ...records.flatMap((record, index) => [
      pause(300),
      effect(() => {
        logInfo(
          label,
          `  ✓ ${record.source} → ${record.destination}`,
        )
        emitProgress(index + 1, [])
      }),
    ]),
    from(records as unknown[]),
  ) as Observable<unknown>
}
