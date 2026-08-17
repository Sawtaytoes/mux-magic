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
import type { AnalysedTitle } from "../tools/discTitles/discTitleAnalysis.js"

/**
 * Where the ripped titles land.
 *
 * A sibling of `DISC-ANALYSIS/` inside the backup, so the proposal and the
 * files it produced travel together and a downstream step can chain off a
 * path it can predict.
 */
export const extractedTitlesFolderName = "EXTRACTED-TITLES"

export type ExtractedTitle = {
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
 * `merge` and `inspect` dispositions are NOT extracted. Merge needs the
 * track-graft path (piece C.2) and inspect needs a human; ripping either
 * on a guess is how you get a wrong file that looks right.
 */
export const extractDiscTitles = ({
  destinationPath,
  disabledRuleNames = [],
  minimumTitleLengthSeconds = 60,
  sourcePath,
  titleIndexes,
}: {
  destinationPath?: string
  disabledRuleNames?: string[]
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
      analysis.titles.filter((analysed: AnalysedTitle) =>
        titleIndexes === undefined
          ? analysed.disposition === "keep"
          : titleIndexes.includes(
              analysed.title.titleIndex,
            ),
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
            .map(
              (analysed) =>
                `#${analysed.title.titleIndex} ${analysed.title.sourceFileName} (${analysed.title.durationText})`,
            )
            .join(", "),
        )

        return { outputFolderPath, selectedTitles }
      }),
    ),
    concatMap(({ outputFolderPath, selectedTitles }) =>
      from(selectedTitles).pipe(
        concatMap((analysed) =>
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
                  map((filePath) => ({
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
