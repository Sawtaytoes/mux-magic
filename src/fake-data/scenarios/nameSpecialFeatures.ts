import { concat, ignoreElements, Observable, of, timer } from "rxjs"

import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"
import { getUserSearchInput } from "../../tools/getUserSearchInput.js"
import { logInfo } from "../../tools/logMessage.js"

// Completes after `ms` without emitting any values — used as a sequenced
// delay inside concat so each phase has realistic pacing.
const pause = (ms: number): Observable<never> => (
  timer(ms).pipe(ignoreElements()) as Observable<never>
)

// Runs a side-effectful function synchronously then immediately completes
// without emitting. Used for log lines + progress ticks inside concat.
const effect = (fn: () => void): Observable<never> => (
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })
)

export const nameSpecialFeaturesScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label = options.label ?? "fake/nameSpecialFeatures"

  logInfo(label, "Starting fake nameSpecialFeatures run.")
  logInfo(label, `Body: ${JSON.stringify(body)}`)

  const emitProgress = (ratio: number) => {
    const jobId = getActiveJobId()
    if (!jobId) return
    const filesTotal = 5
    const filesDone = Math.round(ratio * filesTotal)
    emitJobEvent(jobId, {
      type: "progress",
      ratio,
      filesDone,
      filesTotal,
      currentFiles: [
        { path: `/fake/disc/MOVIE_t0${filesDone + 1}.mkv`, ratio },
      ],
    })
  }

  return concat(
    // Phase 1 — scrape + parse
    effect(() => {
      logInfo(label, "Loading DVDCompare page…")
      emitProgress(0.1)
    }),
    pause(600),
    effect(() => {
      logInfo(label, "Scraped extras text: 1420 chars, 42 non-empty lines")
      logInfo(label, "Parsed 10 extras (8 with timecodes), 2 cuts, 2 untimed suggestions")
      logInfo(label, "Reading file metadata… (padding=0, offset=0)")
      emitProgress(0.2)
    }),
    pause(400),
    effect(() => {
      logInfo(label, "  MOVIE_t01.mkv: 1:45:32")
      logInfo(label, "  MOVIE_t02.mkv: 0:02:05")
      logInfo(label, "  MOVIE_t03.mkv: 0:05:20")
      logInfo(label, "  MOVIE_t04.mkv: 0:12:40")
      logInfo(label, "  MOVIE_t05.mkv: 0:00:48")
      emitProgress(0.4)
    }),
    pause(300),

    // Phase 2 — collision event (t01 target already exists on disk)
    of<unknown>({
      collision: true,
      filename: "MOVIE_t01.mkv",
      targetFilename: "Inception (2010) -featurette",
    }),
    pause(400),

    // Phase 3 — successful renames
    effect(() => {
      logInfo(label, "Renaming MOVIE_t02.mkv → Inception (2010) -trailer")
      emitProgress(0.55)
    }),
    of<unknown>({ oldName: "MOVIE_t02.mkv", newName: "Inception (2010) -trailer" }),
    pause(220),
    effect(() => {
      logInfo(label, "Renaming MOVIE_t03.mkv → Inception (2010) -deleted")
      emitProgress(0.7)
    }),
    of<unknown>({ oldName: "MOVIE_t03.mkv", newName: "Inception (2010) -deleted" }),
    pause(400),

    // Phase 4 — interactive prompt for the two unnamed files.
    // getUserSearchInput emits a SSE `prompt` event on the active job's
    // channel and suspends until the UI sends a /inputs/respond answer.
    // The response index is ignored here — the fake always surfaces the
    // same final summary regardless of what the user picks.
    effect(() => {
      logInfo(label, "Unnamed files with DVDCompare candidate associations:")
      logInfo(label, "  • MOVIE_t04.mkv")
      logInfo(label, "      - Image Gallery (250 images)")
      logInfo(label, "      - Director's Commentary")
      logInfo(label, "  • MOVIE_t05.mkv")
      logInfo(label, "      - Director's Commentary")
      logInfo(label, "      - Image Gallery (250 images)")
      emitProgress(0.8)
    }),
    getUserSearchInput({
      message: (
        "2 files remain unmatched.\n"
        + "Pick the closest DVDCompare entry, or skip to leave them unnamed."
      ),
      options: [
        { index: 0, label: "Image Gallery (250 images)" },
        { index: 1, label: "Director's Commentary" },
        { index: -1, label: "Skip — leave both unnamed" },
      ],
      filePath: "/fake/disc/MOVIE_t04.mkv",
    }).pipe(ignoreElements()),

    // Phase 5 — final summary
    effect(() => {
      logInfo(label, "Summary: 2 renamed, 1 collision, 2 unmatched")
      emitProgress(1.0)
    }),
    of<unknown>({
      unrenamedFilenames: ["MOVIE_t04.mkv", "MOVIE_t05.mkv"],
      possibleNames: [
        { name: "Image Gallery (250 images)" },
        { name: "Director's Commentary" },
      ],
      allKnownNames: [
        "Theatrical Trailer",
        "Deleted Scenes",
        "Behind the Scenes",
        "Image Gallery (250 images)",
        "Director's Commentary",
        "The Making of Inception",
      ],
      unnamedFileCandidates: [
        {
          filename: "MOVIE_t04.mkv",
          candidates: [
            "Image Gallery (250 images)",
            "Director's Commentary",
            "Behind the Scenes",
          ],
        },
        {
          filename: "MOVIE_t05.mkv",
          candidates: [
            "Director's Commentary",
            "Image Gallery (250 images)",
          ],
        },
      ],
    }),
  ) as Observable<unknown>
}
