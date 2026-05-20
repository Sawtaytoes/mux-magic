import { emitJobEvent } from "@mux-magic/core/src/api/jobStore.js"
import { getActiveJobId } from "@mux-magic/core/src/api/logCapture.js"
import { getUserSearchInput } from "@mux-magic/core/src/tools/getUserSearchInput.js"
import { logInfo } from "@mux-magic/tools"
import {
  concat,
  concatMap,
  ignoreElements,
  Observable,
  of,
  timer,
} from "rxjs"

const pause = (ms: number): Observable<never> =>
  timer(ms).pipe(ignoreElements()) as Observable<never>

const effect = (fn: () => void): Observable<never> =>
  new Observable<never>((sub) => {
    fn()
    sub.complete()
  })

export const nameSpecialFeaturesDvdCompareTmdbScenario = (
  body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => {
  const label =
    options.label ??
    "fake/nameSpecialFeaturesDvdCompareTmdb"

  logInfo(
    label,
    "Starting fake nameSpecialFeaturesDvdCompareTmdb run.",
  )
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
        {
          path: `/fake/disc/MOVIE_t0${filesDone + 1}.mkv`,
          ratio,
        },
      ],
    })
  }

  // Phase 2 collision prompt — worker 58 / Part C: fire a real
  // `type: "prompt"` SSE event via getUserSearchInput so the PromptModal
  // opens in fake mode. Previously the collision was just an
  // unprompted result event and the scenario auto-skipped; now the
  // scenario actually pauses for the user's choice, mirroring how a
  // real run would block. The user can dry-run the interactive UX
  // (Play button, Cancel job, Close) without a real DVD rip.
  //
  // Cancel-job contract: when the user clicks "Cancel job" the resulting
  // DELETE /jobs/:id cascades through jobStore.cancelJob, which
  // unsubscribes the outer scenario observable. RxJS tears down the
  // active inner subscription (this `phaseTwoPrompt`), and
  // getUserSearchInput's `return () => cancelPrompt(promptId)` cleanup
  // removes the pending entry from the promptStore. End-to-end, a fake
  // run cancels cleanly with no leaked prompt state — the contract is
  // locked by getUserSearchInput.test.ts.
  const phaseTwoPrompt = getUserSearchInput({
    message:
      "MOVIE_t01.mkv would rename to 'Inception (2010) -featurette', but that file already exists on disk. What should happen?",
    filePath: "/fake/disc/MOVIE_t01.mkv",
    options: [
      { index: 0, label: "Overwrite the existing file" },
      {
        index: 1,
        label:
          "Rename as 'Inception (2010) -featurette (2)'",
      },
      { index: -1, label: "Skip this file" },
    ],
  })

  return concat(
    // Phase 1 — scrape + parse
    effect(() => {
      logInfo(label, "Loading DVDCompare page…")
      emitProgress(0.1)
    }),
    pause(600),
    effect(() => {
      logInfo(
        label,
        "Scraped extras text: 1420 chars, 42 non-empty lines",
      )
      logInfo(
        label,
        "Parsed 10 extras (8 with timecodes), 2 cuts, 2 untimed suggestions",
      )
      logInfo(
        label,
        "Reading file metadata… (padding=0, offset=0)",
      )
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

    // Phase 2 — collision result + interactive prompt
    of<unknown>({
      hasCollision: true,
      filename: "MOVIE_t01.mkv",
      targetFilename: "Inception (2010) -featurette",
    }),
    phaseTwoPrompt.pipe(
      concatMap((selectedIndex) =>
        effect(() => {
          if (selectedIndex === 0) {
            logInfo(
              label,
              "User chose: overwrite MOVIE_t01.mkv → Inception (2010) -featurette",
            )
          } else if (selectedIndex === 1) {
            logInfo(
              label,
              "User chose: rename as 'Inception (2010) -featurette (2)'",
            )
          } else {
            logInfo(label, "User chose: skip MOVIE_t01.mkv")
          }
        }),
      ),
    ),
    pause(200),

    // Phase 3 — successful renames
    effect(() => {
      logInfo(
        label,
        "Renaming MOVIE_t02.mkv → Inception (2010) -trailer",
      )
      emitProgress(0.55)
    }),
    of<unknown>({
      oldName: "MOVIE_t02.mkv",
      newName: "Inception (2010) -trailer",
    }),
    pause(220),
    effect(() => {
      logInfo(
        label,
        "Renaming MOVIE_t03.mkv → Inception (2010) -deleted",
      )
      emitProgress(0.7)
    }),
    of<unknown>({
      oldName: "MOVIE_t03.mkv",
      newName: "Inception (2010) -deleted",
    }),
    pause(400),

    // Phase 4 — two files remain unmatched. The summary emitted in
    // Phase 5 now carries durationSeconds per file plus pre-ranked
    // ScoredCandidate[] (worker 25 moved the scorer server-side).
    effect(() => {
      logInfo(
        label,
        "Unnamed files with DVDCompare candidate associations:",
      )
      logInfo(label, "  • MOVIE_t04.mkv")
      logInfo(label, "      - Image Gallery (250 images)")
      logInfo(label, "      - Director's Commentary")
      logInfo(label, "  • MOVIE_t05.mkv")
      logInfo(label, "      - Director's Commentary")
      logInfo(label, "      - Image Gallery (250 images)")
      // Worker 25: leftovers auto-move into UNNAMED-FEATURES/ as
      // the rename pass completes. The fake scenario doesn't touch
      // disk, but the log line mirrors the real run so dry-run
      // testing of the post-NSF flow shows the user what they'll see.
      logInfo(
        label,
        "MOVED TO BUCKET: MOVIE_t04.mkv → UNNAMED-FEATURES/",
      )
      logInfo(
        label,
        "MOVED TO BUCKET: MOVIE_t05.mkv → UNNAMED-FEATURES/",
      )
      emitProgress(0.8)
    }),
    pause(300),

    // Phase 5 — final summary
    effect(() => {
      logInfo(
        label,
        "Summary: 2 renamed, 1 collision, 2 unmatched",
      )
      emitProgress(1.0)
    }),
    of<unknown>({
      unrenamedFilenames: [
        "MOVIE_t04.mkv",
        "MOVIE_t05.mkv",
      ],
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
      // Worker 25: server now emits already-ranked `ScoredCandidate[]`
      // with confidence + per-signal scores so the Smart Match modal can
      // render straight from the payload — no client-side re-ranking.
      // The two entries below are realistic confidence numbers for the
      // happy path (high-confidence filename-overlap match on top,
      // weaker fallback below).
      unnamedFileCandidates: [
        {
          filename: "MOVIE_t04.mkv",
          extension: ".mkv",
          durationSeconds: 760,
          rankedCandidates: [
            {
              candidate: {
                name: "Image Gallery (250 images)",
                timecode: undefined,
              },
              confidence: 0.6,
              durationScore: Number.NaN,
              filenameScore: 1,
            },
            {
              candidate: {
                name: "Director's Commentary",
                timecode: undefined,
              },
              confidence: 0,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
            {
              candidate: {
                name: "Behind the Scenes",
                timecode: undefined,
              },
              confidence: 0,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
          ],
        },
        {
          filename: "MOVIE_t05.mkv",
          extension: ".mkv",
          durationSeconds: 48,
          rankedCandidates: [
            {
              candidate: {
                name: "Director's Commentary",
                timecode: undefined,
              },
              confidence: 0.05,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
            {
              candidate: {
                name: "Image Gallery (250 images)",
                timecode: undefined,
              },
              confidence: 0,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
          ],
        },
      ],
    }),
  ) as Observable<unknown>
}
