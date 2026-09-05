import { dirname, join } from "node:path"

import { TRIMMED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const trimmedFolderName = TRIMMED_FOLDER_NAME

type TrimTailMkvMergeRequiredProps = {
  endTime: string
  filePath: string
}

type TrimTailMkvMergeOptionalProps = {
  outputFolderName?: string
}

export type TrimTailMkvMergeProps =
  TrimTailMkvMergeRequiredProps &
    TrimTailMkvMergeOptionalProps

export const trimTailMkvMergeDefaultProps = {
  outputFolderName: TRIMMED_FOLDER_NAME,
} satisfies TrimTailMkvMergeOptionalProps

// `--split parts:-<end>` keeps a single range running from the start of
// the file to `<end>` and discards everything after it. mkvmerge only
// cuts on a keyframe, so the delivered endpoint can land later than the
// requested one — the app-command reads the result back and reports both.
export const trimTailMkvMerge = ({
  endTime,
  filePath,
  outputFolderName = trimTailMkvMergeDefaultProps.outputFolderName,
}: TrimTailMkvMergeProps) =>
  runMkvMerge({
    args: [
      "--split",
      `parts:-${endTime}`,

      filePath,
    ],
    outputFilePath: filePath.replace(
      dirname(filePath),
      join(dirname(filePath), outputFolderName),
    ),
  })
