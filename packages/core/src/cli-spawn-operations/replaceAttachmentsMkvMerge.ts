import { dirname, join } from "node:path"
import { concatMap, endWith, filter, of } from "rxjs"

import { getIsVideoFile } from "../tools/filterIsVideoFile.js"
import { REPLACED_ATTACHMENTS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const replacedAttachmentsFolderName =
  REPLACED_ATTACHMENTS_FOLDER_NAME

type ReplaceAttachmentsMkvMergeRequiredProps = {
  destinationFilePath: string
  sourceFilePath: string
}

type ReplaceAttachmentsMkvMergeOptionalProps = {
  outputFolderName?: string
}

export type ReplaceAttachmentsMkvMergeProps =
  ReplaceAttachmentsMkvMergeRequiredProps &
    ReplaceAttachmentsMkvMergeOptionalProps

export const replaceAttachmentsMkvMergeDefaultProps = {
  outputFolderName: REPLACED_ATTACHMENTS_FOLDER_NAME,
} satisfies ReplaceAttachmentsMkvMergeOptionalProps

export const replaceAttachmentsMkvMerge = ({
  destinationFilePath,
  outputFolderName = replaceAttachmentsMkvMergeDefaultProps.outputFolderName,
  sourceFilePath,
}: ReplaceAttachmentsMkvMergeProps) =>
  of(getIsVideoFile(sourceFilePath)).pipe(
    filter(Boolean),
    // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
    endWith(null),
    concatMap(() =>
      runMkvMerge({
        args: [
          "--no-audio",
          "--no-buttons",
          "--no-chapters",
          "--no-global-tags",
          "--no-subtitles",
          "--no-track-tags",
          "--no-video",

          sourceFilePath,

          destinationFilePath,
        ],
        outputFilePath: destinationFilePath.replace(
          dirname(destinationFilePath),
          join(
            dirname(destinationFilePath),
            outputFolderName,
          ),
        ),
      }),
    ),
  )
