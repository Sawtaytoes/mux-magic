import {
  concatMap,
  filter,
  from,
  take,
  tap,
  toArray,
} from "rxjs"
import {
  splitChaptersMkvMerge,
  splitChaptersMkvMergeDefaultProps,
} from "../cli-spawn-operations/splitChaptersMkvMerge.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFiles } from "../tools/getFiles.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { logInfo } from "../tools/logMessage.js"
import { naturalSort } from "../tools/naturalSort.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type SplitChaptersRequiredProps = {
  chapterSplitsList: string[]
  sourcePath: string
}

type SplitChaptersOptionalProps = {
  outputFolderName?: string
}

export type SplitChaptersProps =
  SplitChaptersRequiredProps & SplitChaptersOptionalProps

export const splitChaptersDefaultProps = {
  outputFolderName:
    splitChaptersMkvMergeDefaultProps.outputFolderName,
} satisfies SplitChaptersOptionalProps

export const splitChapters = ({
  chapterSplitsList,
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
                "CREATED SUBTITLED FILE",
                fileInfo.fullPath,
              )
            }),
            filter(Boolean),
          ),
        ),
        toArray(),
      ),
    ),
    logAndRethrow(splitChapters),
  )
