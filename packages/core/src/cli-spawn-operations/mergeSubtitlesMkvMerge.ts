import { dirname, join } from "node:path"
import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { concatMap, endWith } from "rxjs"
import { SUBTITLED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import {
  decodeSubtitleTrackName,
  findEncodedTrackName,
} from "../tools/subtitleTrackNames.js"
import { defineLanguageForUndefinedTracks } from "./defineLanguageForUndefinedTracks.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const subtitledFolderName = SUBTITLED_FOLDER_NAME

const trackNameArgsOf = (
  encodedSegment: string | undefined,
) =>
  encodedSegment
    ? [
        "--track-name",
        `0:${decodeSubtitleTrackName(encodedSegment)}`,
      ]
    : []

// The track name is provenance — which group the subs came from. A
// standalone subtitle file can't carry it, so extraction encodes it into
// the filename and this puts it back on the muxed track.
export const buildSubtitleSourceArgs = (
  subtitlesFilesPaths: ReadonlyArray<string>,
) =>
  subtitlesFilesPaths.flatMap((subtitleFilePath) =>
    trackNameArgsOf(
      findEncodedTrackName(subtitleFilePath),
    ).concat(subtitleFilePath),
  )

type MergeSubtitlesMkvMergeRequiredProps = {
  attachmentFilePaths: string[]
  destinationFilePath: string
  subtitlesFilesPaths: string[]
  subtitlesLanguage: LanguageSelection
}

type MergeSubtitlesMkvMergeOptionalProps = {
  chaptersFilePath?: string
  offsetInMilliseconds?: number
  outputFolderName?: string
}

export type MergeSubtitlesMkvMergeProps =
  MergeSubtitlesMkvMergeRequiredProps &
    MergeSubtitlesMkvMergeOptionalProps

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
}: MergeSubtitlesMkvMergeProps) =>
  runMkvMerge({
    args: [
      "--no-subtitles",

      destinationFilePath,

      "--no-video",
      "--no-audio",
      "--no-chapters",
      "--no-buttons",
      "--no-global-tags",

      ...(offsetInMilliseconds
        ? ["--sync", `-1:${offsetInMilliseconds}`]
        : []),

      ...buildSubtitleSourceArgs(subtitlesFilesPaths),

      ...(chaptersFilePath
        ? ["--chapters", chaptersFilePath]
        : []),

      ...(attachmentFilePaths || []).flatMap(
        (attachmentFilePath) => [
          "--attach-file",
          attachmentFilePath,
        ],
      ),
    ],
    outputFilePath: destinationFilePath.replace(
      dirname(destinationFilePath),
      join(dirname(destinationFilePath), outputFolderName),
    ),
  }).pipe(
    concatMap(() =>
      defineLanguageForUndefinedTracks({
        filePath: destinationFilePath.replace(
          dirname(destinationFilePath),
          join(
            dirname(destinationFilePath),
            outputFolderName,
          ),
        ),
        languageSelection: subtitlesLanguage,
        trackType: "subtitles",
      }).pipe(
        // TODO: Remove this. It's causing 2 logs instead of 1.
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(null),
      ),
    ),
  )
