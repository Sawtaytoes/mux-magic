import { dirname, join } from "node:path"
import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { logAndSwallowPipelineError } from "@mux-magic/tools"
import type { Observable } from "rxjs"
import { LANGUAGE_TRIMMED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js"

type KeepSpecifiedLanguageTracksRequiredProps = {
  audioLanguages: LanguageSelection[]
  filePath: string
  subtitlesLanguages: LanguageSelection[]
}

type KeepSpecifiedLanguageTracksOptionalProps = {
  outputFolderName?: string
}

export type KeepSpecifiedLanguageTracksProps =
  KeepSpecifiedLanguageTracksRequiredProps &
    KeepSpecifiedLanguageTracksOptionalProps

export const keepSpecifiedLanguageTracksDefaultProps = {
  outputFolderName: LANGUAGE_TRIMMED_FOLDER_NAME,
} satisfies KeepSpecifiedLanguageTracksOptionalProps

export const keepSpecifiedLanguageTracks = ({
  audioLanguages,
  filePath,
  outputFolderName = keepSpecifiedLanguageTracksDefaultProps.outputFolderName,
  subtitlesLanguages,
}: KeepSpecifiedLanguageTracksProps): Observable<string> => {
  const hasAudioLanguages = audioLanguages.length > 0

  const hasSubtitlesLanguages =
    subtitlesLanguages.length > 0

  return runMkvMerge({
    args: [
      ...(hasAudioLanguages
        ? [
            "--audio-tracks",
            audioLanguages
              .map((selection) => selection.code)
              .join(","),
          ]
        : []),

      ...(hasSubtitlesLanguages
        ? [
            "--subtitle-tracks",
            subtitlesLanguages
              .map((selection) => selection.code)
              .join(","),
          ]
        : []),

      filePath,
    ],
    outputFilePath: filePath.replace(
      dirname(filePath),
      join(dirname(filePath), outputFolderName),
    ),
  }).pipe(
    logAndSwallowPipelineError(keepSpecifiedLanguageTracks),
  )
}
