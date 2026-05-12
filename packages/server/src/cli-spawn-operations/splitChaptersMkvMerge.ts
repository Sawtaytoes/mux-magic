import { dirname, join } from "node:path"

import { SPLITS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const splitsFolderName = SPLITS_FOLDER_NAME

type SplitChaptersMkvMergeRequiredProps = {
  chapterSplits: string
  filePath: string
}

type SplitChaptersMkvMergeOptionalProps = {
  outputFolderName?: string
}

export type SplitChaptersMkvMergeProps =
  SplitChaptersMkvMergeRequiredProps &
    SplitChaptersMkvMergeOptionalProps

export const splitChaptersMkvMergeDefaultProps = {
  outputFolderName: SPLITS_FOLDER_NAME,
} satisfies SplitChaptersMkvMergeOptionalProps

export const splitChaptersMkvMerge = ({
  chapterSplits,
  filePath,
  outputFolderName = splitChaptersMkvMergeDefaultProps.outputFolderName,
}: SplitChaptersMkvMergeProps) =>
  runMkvMerge({
    args: [
      "--split",
      `chapters:${chapterSplits}`,

      filePath,
    ],
    outputFilePath: filePath.replace(
      dirname(filePath),
      join(dirname(filePath), outputFolderName),
    ),
  })
