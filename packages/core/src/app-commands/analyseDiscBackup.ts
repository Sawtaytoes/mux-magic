import { mkdir, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  map,
  type Observable,
  tap,
} from "rxjs"

import { runMakeMkvCon } from "../cli-spawn-operations/runMakeMkvCon.js"
import { buildDiscAnalysis } from "../tools/discTitles/buildDiscAnalysis.js"
import type { DiscAnalysis } from "../tools/discTitles/discTitleAnalysis.js"

/**
 * Where the analysis lives on disk.
 *
 * The filesystem IS the state — same model as Name Special Features. The
 * sidecar sits inside the `[BACKUP]` folder it describes, so a refresh,
 * crash or "I'll finish tomorrow" loses nothing and the analysis travels
 * with the backup.
 */
export const discAnalysisFolderName = "DISC-ANALYSIS"
export const discAnalysisFileName = "analysis.json"
/**
 * The owner's confirmed dispositions, written by the review UI beside the
 * proposal. Kept separate from `analysis.json` so re-analysing a backup
 * (new rules, a fixed heuristic) never overwrites a human decision — and
 * so the accumulated confirmations become the labelled regression corpus
 * that lets the heuristics get measurably better rather than just
 * accumulating.
 */
export const confirmedDispositionsFileName =
  "confirmed.json"

/**
 * Read a `[BACKUP]` folder and propose what to rip.
 *
 * Emits a title graph plus computed clusters and a per-title disposition
 * with a stated reason, and writes it to `DISC-ANALYSIS/analysis.json`.
 *
 * Nothing is deleted, moved or ripped by this command. Every discard is a
 * proposal with a reason, the full title list stays available, and the
 * backup itself is untouched.
 */
export const analyseDiscBackup = ({
  disabledRuleNames = [],
  minimumTitleLengthSeconds = 10,
  sourcePath,
}: {
  disabledRuleNames?: string[]
  minimumTitleLengthSeconds?: number
  sourcePath: string
}): Observable<DiscAnalysis> =>
  runMakeMkvCon({
    minimumTitleLengthSeconds,
    sourcePath,
  }).pipe(
    map((graph) =>
      buildDiscAnalysis({ disabledRuleNames, graph }),
    ),
    tap((analysis) => {
      logInfo(
        "DISC ANALYSIS",
        `${basename(sourcePath)}: ${analysis.titles.length} titles, ${
          analysis.clusters.length
        } clusters`,
        analysis.titles
          .filter(
            (analysed) => analysed.disposition !== "keep",
          )
          .map(
            (analysed) =>
              `${analysed.title.sourceFileName} -> ${analysed.disposition}`,
          )
          .join(", "),
      )
    }),
    concatMap((analysis) =>
      defer(async () => {
        const analysisFolderPath = join(
          sourcePath,
          discAnalysisFolderName,
        )

        await mkdir(analysisFolderPath, {
          recursive: true,
        })
        await writeFile(
          join(analysisFolderPath, discAnalysisFileName),
          JSON.stringify(analysis, null, 2),
          "utf8",
        )

        return analysis
      }),
    ),
    logAndRethrowPipelineError(analyseDiscBackup),
  )
