import path, {
  dirname,
  join,
} from "node:path"
import {
  concatMap,
  endWith,
} from "rxjs";

import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { SUBTITLED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";
import {
  defineLanguageForUndefinedTracks,
} from "./defineLanguageForUndefinedTracks.js";

export const subtitledFolderName = SUBTITLED_FOLDER_NAME

type MergeSubtitlesMkvMergeRequiredProps = {
  attachmentFilePaths: string[]
  destinationFilePath: string
  subtitlesFilesPaths: string[]
  subtitlesLanguage: Iso6392LanguageCode
}

type MergeSubtitlesMkvMergeOptionalProps = {
  chaptersFilePath?: string
  offsetInMilliseconds?: number
  outputFolderName?: string
}

export type MergeSubtitlesMkvMergeProps = MergeSubtitlesMkvMergeRequiredProps & MergeSubtitlesMkvMergeOptionalProps

export const mergeSubtitlesMkvMergeDefaultProps = {
  outputFolderName: SUBTITLED_FOLDER_NAME,
} satisfies MergeSubtitlesMkvMergeOptionalProps

export const mergeSubtitlesMkvMerge = ({
  attachmentFilePaths,
  destinationFilePath,
  chaptersFilePath,
  offsetInMilliseconds,
  outputFolderName = mergeSubtitlesMkvMergeDefaultProps.outputFolderName,
  subtitlesFilesPaths,
  subtitlesLanguage,
}: MergeSubtitlesMkvMergeProps) => (
  runMkvMerge({
    args: [
      "--no-subtitles",

      destinationFilePath,

      "--no-video",
      "--no-audio",
      "--no-chapters",
      "--no-buttons",
      "--no-global-tags",

      ...(
        offsetInMilliseconds
        ? [
          "--sync",
          `-1:${offsetInMilliseconds}`,
        ]
        : []
      ),

      ...subtitlesFilesPaths,

      ...(
        chaptersFilePath
        ? [
          "--chapters",
          chaptersFilePath,
        ]
        : []
      ),

      ...(
        (
          attachmentFilePaths
          || []
        )
        .flatMap((
          attachmentFilePath,
        ) => ([
          "--attach-file",
          attachmentFilePath,
        ]))
      ),
    ],
    outputFilePath: (
      destinationFilePath
      .replace(
        (
          dirname(
            destinationFilePath
          )
        ),
        (
          join(
            (
              dirname(
                destinationFilePath
              )
            ),
            outputFolderName,
          )
        ),
      )
    )
  })
  .pipe(
    concatMap(() => (
      defineLanguageForUndefinedTracks({
        filePath: (
          destinationFilePath
          .replace(
            (
              dirname(
                destinationFilePath
              )
            ),
            (
              join(
                (
                  dirname(
                    destinationFilePath
                  )
                ),
                outputFolderName,
              )
            ),
          )
        ),
        subtitleLanguage: subtitlesLanguage,
        trackType: "subtitles",
      })
      .pipe(
        // TODO: Remove this. It's causing 2 logs instead of 1.
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(
          null
        ),
      )
    )),
  )
)
