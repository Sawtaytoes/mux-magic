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
// the file to `<end>` and discards everything after it.
//
// mkvmerge cuts at the first keyframe **at or after** `<end>`, so the
// delivered endpoint is never earlier than the request and can be a whole
// keyframe interval later. Asking for 4 ms past a keyframe therefore costs
// the next 0.5 s of video, which is enough to leave the first frames of
// whatever you meant to remove. Aim at the keyframe itself, or just before
// it. The app-command reads the result back and reports the requested and
// the delivered length so the overshoot is visible.
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
