import {
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { replaceAttachmentsMkvMerge, replaceAttachmentsMkvMergeDefaultProps } from "../cli-spawn-operations/replaceAttachmentsMkvMerge.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReplaceAttachmentsRequiredProps = {
  destinationFilesPath: string
  sourceFilesPath: string
}

type ReplaceAttachmentsOptionalProps = {
  outputFolderName?: string
}

export type ReplaceAttachmentsProps = ReplaceAttachmentsRequiredProps & ReplaceAttachmentsOptionalProps

export const replaceAttachmentsDefaultProps = {
  outputFolderName: replaceAttachmentsMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceAttachmentsOptionalProps

export const replaceAttachments = ({
  destinationFilesPath,
  outputFolderName = replaceAttachmentsDefaultProps.outputFolderName,
  sourceFilesPath,
}: ReplaceAttachmentsProps) => (
  getFiles({
    sourcePath: (
      sourceFilesPath
    ),
  })
  .pipe(
    toArray(),
    concatMap((
      mediaFiles,
    ) => (
      getFiles({
        sourcePath: (
          destinationFilesPath
        ),
      })
      .pipe(
        map((
          mediaFileInfo,
        ) => ({
          destinationFilePath: (
            mediaFileInfo
            .fullPath
          ),
          mediaFileInfo,
          mediaFilePath: (
            (
              mediaFiles
              .find((
                subtitlesFileInfo,
              ) => (
                (
                  subtitlesFileInfo
                  .filename
                )
                === (
                  mediaFileInfo
                  .filename
                )
              ))
              ?.fullPath
            )
            || ""
          ),
        })),
        filter(({
          mediaFilePath,
        }) => (
          Boolean(
            mediaFilePath
          )
        )),
        withFileProgress(({
          destinationFilePath,
          mediaFileInfo,
          mediaFilePath,
        }) => (
          replaceAttachmentsMkvMerge({
            destinationFilePath,
            outputFolderName,
            sourceFilePath: mediaFilePath,
          })
          .pipe(
            tap(() => {
              logInfo(
                "CREATED FILE WITH ATTACHMENTS",
                (
                  mediaFileInfo
                  .fullPath
                ),
              )
            }),
            filter(
              Boolean
            ),
          )
        )),
        toArray(),
      )
    )),
    logAndRethrow(
      replaceAttachments
    ),
  )
)
