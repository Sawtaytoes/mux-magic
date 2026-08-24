import { readdir } from "node:fs/promises"
import { dirname } from "node:path"
import {
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
  naturalSort,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  filter,
  from,
  map,
  of,
  take,
  tap,
  toArray,
} from "rxjs"
import {
  splitChaptersMkvMerge,
  splitChaptersMkvMergeDefaultProps,
} from "../cli-spawn-operations/splitChaptersMkvMerge.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getSplitOutputFilePaths } from "../tools/getSplitOutputFilePaths.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { renumberChaptersInFile } from "../tools/renumberChaptersInFile.js"

type SplitChaptersRequiredProps = {
  chapterSplitsList: string[]
  sourcePath: string
}

type SplitChaptersOptionalProps = {
  isPaddingChapterNumbers?: boolean
  isRenumberingChapters?: boolean
  outputFolderName?: string
}

export type SplitChaptersProps =
  SplitChaptersRequiredProps & SplitChaptersOptionalProps

export const splitChaptersDefaultProps = {
  isPaddingChapterNumbers: true,
  isRenumberingChapters: true,
  outputFolderName:
    splitChaptersMkvMergeDefaultProps.outputFolderName,
} satisfies SplitChaptersOptionalProps

// A split part inherits the play-all file's chapter names, so part 2 opens
// on `Chapter 04` rather than `Chapter 01`. Renumber each part the moment
// mkvmerge writes it, so the episode stands on its own.
const renumberSplitParts = ({
  isPaddingChapterNumbers,
  outputFilePath,
}: {
  isPaddingChapterNumbers: boolean
  outputFilePath: string
}) =>
  defer(() => readdir(dirname(outputFilePath))).pipe(
    concatMap((fileNames) =>
      from(
        getSplitOutputFilePaths({
          fileNames,
          outputFilePath,
        }),
      ),
    ),
    concatMap((splitFilePath) =>
      renumberChaptersInFile({
        filePath: splitFilePath,
        isPaddingChapterNumbers,
      }).pipe(
        tap((result) => {
          logInfo(
            "RENUMBERED CHAPTERS",
            `${result.filePath}: ${result.action}`,
          )
        }),
      ),
    ),
    toArray(),
    map(() => outputFilePath),
  )

export const splitChapters = ({
  chapterSplitsList,
  isPaddingChapterNumbers = splitChaptersDefaultProps.isPaddingChapterNumbers,
  isRenumberingChapters = splitChaptersDefaultProps.isRenumberingChapters,
  outputFolderName = splitChaptersDefaultProps.outputFolderName,
  sourcePath,
}: SplitChaptersProps) =>
  getFiles({
    sourcePath,
  }).pipe(
    toArray(),
    concatMap((fileInfos) =>
      from(
        naturalSort(fileInfos).by({
          asc: (fileInfo) => fileInfo.filename,
        }),
      ).pipe(
        filterIsVideoFile(),
        take(chapterSplitsList.length),
        withFileProgress((fileInfo, index) =>
          splitChaptersMkvMerge({
            chapterSplits: chapterSplitsList[index]
              .split(" ")
              .join(","),
            filePath: fileInfo.fullPath,
            outputFolderName,
          }).pipe(
            tap(() => {
              logInfo(
                "CREATED SPLIT FILES",
                fileInfo.fullPath,
              )
            }),
            filter(Boolean),
            concatMap((outputFilePath) =>
              isRenumberingChapters
                ? renumberSplitParts({
                    isPaddingChapterNumbers,
                    outputFilePath,
                  })
                : of(outputFilePath),
            ),
          ),
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(splitChapters),
  )
