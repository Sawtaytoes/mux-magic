import {
  getFiles,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, filter, map, tap, toArray } from "rxjs"
import {
  replaceAttachmentsMkvMerge,
  replaceAttachmentsMkvMergeDefaultProps,
} from "../cli-spawn-operations/replaceAttachmentsMkvMerge.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReplaceAttachmentsRequiredProps = {
  destinationFilesPath: string
  sourcePath: string
}

type ReplaceAttachmentsOptionalProps = {
  outputFolderName?: string
}

export type ReplaceAttachmentsProps =
  ReplaceAttachmentsRequiredProps &
    ReplaceAttachmentsOptionalProps

export const replaceAttachmentsDefaultProps = {
  outputFolderName:
    replaceAttachmentsMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceAttachmentsOptionalProps

export const replaceAttachments = ({
  destinationFilesPath,
  outputFolderName = replaceAttachmentsDefaultProps.outputFolderName,
  sourcePath,
}: ReplaceAttachmentsProps) =>
  getFiles({
    sourcePath,
  }).pipe(
    toArray(),
    concatMap((mediaFiles) =>
      getFiles({
        sourcePath: destinationFilesPath,
      }).pipe(
        map((mediaFileInfo) => ({
          destinationFilePath: mediaFileInfo.fullPath,
          mediaFileInfo,
          mediaFilePath:
            mediaFiles.find(
              (subtitlesFileInfo) =>
                subtitlesFileInfo.filename ===
                mediaFileInfo.filename,
            )?.fullPath || "",
        })),
        filter(({ mediaFilePath }) =>
          Boolean(mediaFilePath),
        ),
        withFileProgress(
          ({
            destinationFilePath,
            mediaFileInfo,
            mediaFilePath,
          }) =>
            replaceAttachmentsMkvMerge({
              destinationFilePath,
              outputFolderName,
              sourceFilePath: mediaFilePath,
            }).pipe(
              tap(() => {
                logInfo(
                  "CREATED FILE WITH ATTACHMENTS",
                  mediaFileInfo.fullPath,
                )
              }),
              filter(Boolean),
            ),
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(replaceAttachments),
  )
