import { dirname, join } from "node:path"
import { concatMap, endWith, of } from "rxjs"
import { getIsVideoFile } from "../tools/filterIsVideoFile.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { REPLACED_TRACKS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { defineLanguageForUndefinedTracks } from "./defineLanguageForUndefinedTracks.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const replacedTracksFolderName =
  REPLACED_TRACKS_FOLDER_NAME

type ReplaceTracksMkvMergeRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilePath: string
  hasChapters: boolean
  sourceFilePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}

type ReplaceTracksMkvMergeOptionalProps = {
  offsetInMilliseconds?: number
  outputFolderName?: string
}

export type ReplaceTracksMkvMergeProps =
  ReplaceTracksMkvMergeRequiredProps &
    ReplaceTracksMkvMergeOptionalProps

export const replaceTracksMkvMergeDefaultProps = {
  outputFolderName: REPLACED_TRACKS_FOLDER_NAME,
} satisfies ReplaceTracksMkvMergeOptionalProps

export const replaceTracksMkvMerge = ({
  audioLanguages,
  destinationFilePath,
  hasChapters,
  offsetInMilliseconds,
  outputFolderName = replaceTracksMkvMergeDefaultProps.outputFolderName,
  sourceFilePath,
  subtitlesLanguages,
  videoLanguages,
}: ReplaceTracksMkvMergeProps) => {
  const hasAudioLanguages = audioLanguages.length > 0

  const hasSubtitlesLanguages =
    subtitlesLanguages.length > 0

  const hasVideoLanguages = videoLanguages.length > 0

  const isVideoFile = getIsVideoFile(sourceFilePath)

  return isVideoFile
    ? defineLanguageForUndefinedTracks({
        filePath: sourceFilePath,
        subtitleLanguage: subtitlesLanguages[0] || "eng",
        trackType: "subtitles",
      }).pipe(
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(null),
        concatMap(() =>
          runMkvMerge({
            args: [
              ...(hasAudioLanguages ? ["--no-audio"] : []),

              ...(hasSubtitlesLanguages
                ? ["--no-subtitles"]
                : []),

              ...(hasVideoLanguages ? ["--no-video"] : []),

              destinationFilePath,

              "--no-buttons",
              "--no-global-tags",

              ...(hasChapters ? [] : ["--no-chapters"]),

              ...(offsetInMilliseconds
                ? ["--sync", `-1:${offsetInMilliseconds}`]
                : []),

              ...(isVideoFile && hasAudioLanguages
                ? [
                    "--audio-tracks",
                    audioLanguages.join(","),
                  ]
                : ["--no-audio"]),

              ...(isVideoFile && hasSubtitlesLanguages
                ? [
                    "--subtitle-tracks",
                    subtitlesLanguages.join(","),
                  ]
                : ["--no-subtitles"]),

              ...(isVideoFile && hasVideoLanguages
                ? [
                    "--video-tracks",
                    videoLanguages.join(","),
                  ]
                : ["--no-video"]),

              sourceFilePath,
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
    : of(null)
}
