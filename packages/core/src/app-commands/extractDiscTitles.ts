import { mkdir, stat } from "node:fs/promises"
import { basename, join } from "node:path"

import {
  logAndRethrowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  from,
  map,
  type Observable,
  of,
  tap,
  toArray,
} from "rxjs"

import { runMakeMkvCon } from "../cli-spawn-operations/runMakeMkvCon.js"
import { runMakeMkvConExtract } from "../cli-spawn-operations/runMakeMkvConExtract.js"
import { buildDiscAnalysis } from "../tools/discTitles/buildDiscAnalysis.js"
import { buildTrackSupersetPlans } from "../tools/discTitles/buildTrackSupersetPlans.js"
import type { AnalysedTitle } from "../tools/discTitles/discTitleAnalysis.js"
import { graftPlaylistChapters } from "../tools/discTitles/graftPlaylistChapters.js"

/**
 * Where the ripped titles land.
 *
 * A sibling of `DISC-ANALYSIS/` inside the backup, so the proposal and the
 * files it produced travel together and a downstream step can chain off a
 * path it can predict.
 */
export const extractedTitlesFolderName = "EXTRACTED-TITLES"

export type ExtractedTitle = {
  /** The `.mpls` its chapter marks were grafted from, or null if none were. */
  chapterSourceFileName: string | null
  filePath: string
  isAlreadyExtracted: boolean
  sourceFileName: string
  titleIndex: number
}

const getIsExistingFile = (filePath: string) =>
  stat(filePath)
    .then((stats) => stats.isFile())
    .catch(() => false)

/**
 * Rip the titles a disc analysis proposed keeping.
 *
 * The analysis says WHAT to rip and this says nothing about it: every
 * title whose disposition is `keep` is extracted, in title order, one
 * makemkvcon invocation each. Naming is deliberately left alone —
 * makemkvcon's `<disc> _tNN.mkv` output is what the existing
 * `nameSpecialFeaturesDvdCompareTmdb` step expects to rename, so this
 * command has no naming logic of its own to disagree with it.
 *
 * `merge` and `inspect` dispositions are NOT extracted by default, because
 * ripping either on a guess is how you get a wrong file that looks right.
 *
 * `isRippingTrackSupersets` opts into the one case that is no longer a
 * guess: a cluster where one title carries every track its siblings expose
 * (Soylent Green's raw `00425.m2ts` — LPCM mono plus all three DD 2.0,
 * where each playlist holds a subset). That title is ripped once instead
 * of ripping three 65.5 GB playlists, and the chapter marks it lacks are
 * grafted from the richest sibling playlist's `.mpls`. Off by default:
 * the superset is exactly the title `isChapterlessTwin` proposes
 * discarding, so taking it is a decision the caller makes, not one a rule
 * makes quietly on another rule's behalf.
 */
export const extractDiscTitles = ({
  destinationPath,
  disabledRuleNames = [],
  isRippingTrackSupersets = false,
  minimumTitleLengthSeconds = 10,
  sourcePath,
  titleIndexes,
}: {
  destinationPath?: string
  disabledRuleNames?: string[]
  isRippingTrackSupersets?: boolean
  minimumTitleLengthSeconds?: number
  sourcePath: string
  titleIndexes?: number[]
}): Observable<ExtractedTitle[]> =>
  runMakeMkvCon({
    minimumTitleLengthSeconds,
    sourcePath,
  }).pipe(
    map((graph) =>
      buildDiscAnalysis({ disabledRuleNames, graph }),
    ),
    map((analysis) =>
      ((plans) =>
        analysis.titles
          .filter((analysed: AnalysedTitle) =>
            titleIndexes === undefined
              ? analysed.disposition === "keep" ||
                plans.some(
                  (plan) =>
                    plan.titleIndex ===
                    analysed.title.titleIndex,
                )
              : titleIndexes.includes(
                  analysed.title.titleIndex,
                ),
          )
          .map((analysed) => ({
            analysed,
            chapterSourceFileName:
              plans.find(
                (plan) =>
                  plan.titleIndex ===
                  analysed.title.titleIndex,
              )?.chapterSourceFileName ?? null,
          })))(
        isRippingTrackSupersets
          ? buildTrackSupersetPlans({ analysis })
          : [],
      ),
    ),
    concatMap((selectedTitles) =>
      defer(async () => {
        const outputFolderPath =
          destinationPath ??
          join(sourcePath, extractedTitlesFolderName)

        await mkdir(outputFolderPath, { recursive: true })

        logInfo(
          "EXTRACT DISC TITLES",
          `${basename(sourcePath)}: ${selectedTitles.length} titles -> ${outputFolderPath}`,
          selectedTitles
            .map(({ analysed, chapterSourceFileName }) =>
              `#${analysed.title.titleIndex} ${analysed.title.sourceFileName} (${analysed.title.durationText})`.concat(
                chapterSourceFileName === null
                  ? ""
                  : ` +chapters from ${chapterSourceFileName}`,
              ),
            )
            .join(", "),
        )

        return { outputFolderPath, selectedTitles }
      }),
    ),
    concatMap(({ outputFolderPath, selectedTitles }) =>
      from(selectedTitles).pipe(
        concatMap(({ analysed, chapterSourceFileName }) =>
          defer(() =>
            getIsExistingFile(
              join(
                outputFolderPath,
                analysed.title.outputFileName,
              ),
            ).then((isAlreadyExtracted) => ({
              isAlreadyExtracted,
              outputFilePath: join(
                outputFolderPath,
                analysed.title.outputFileName,
              ),
            })),
          ).pipe(
            concatMap(
              ({ isAlreadyExtracted, outputFilePath }) =>
                (isAlreadyExtracted
                  ? // Re-ripping a 30 GB feature because a later title
                    // failed is the expensive way to find out this
                    // command is not resumable.
                    of(outputFilePath).pipe(
                      tap(() => {
                        logWarning(
                          "EXTRACT DISC TITLES",
                          `Skipping title #${analysed.title.titleIndex}: ${outputFilePath} already exists.`,
                        )
                      }),
                    )
                  : runMakeMkvConExtract({
                      destinationPath: outputFolderPath,
                      minimumTitleLengthSeconds,
                      outputFilePath,
                      sourcePath,
                      titleIndex: analysed.title.titleIndex,
                    })
                ).pipe(
                  concatMap((filePath) =>
                    getIsExistingFile(filePath).then(
                      (isExtracted) =>
                        isExtracted
                          ? filePath
                          : Promise.reject(
                              new Error(
                                `makemkvcon reported success for title #${analysed.title.titleIndex} but ${filePath} does not exist.`,
                              ),
                            ),
                    ),
                  ),
                  // Grafted after every run, including the skipped-rip
                  // path: mkvpropedit replaces chapters rather than
                  // appending, so it is idempotent, and a resumed job
                  // whose rip died before the graft still ends chaptered.
                  concatMap((filePath) =>
                    chapterSourceFileName === null
                      ? of(filePath)
                      : graftPlaylistChapters({
                          chapterSourceFileName,
                          filePath,
                          sourcePath,
                        }),
                  ),
                  map((filePath) => ({
                    chapterSourceFileName,
                    filePath,
                    isAlreadyExtracted,
                    sourceFileName:
                      analysed.title.sourceFileName,
                    titleIndex: analysed.title.titleIndex,
                  })),
                ),
            ),
          ),
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(extractDiscTitles),
  )
