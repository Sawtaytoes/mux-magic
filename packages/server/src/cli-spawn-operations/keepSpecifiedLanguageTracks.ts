import {
  Observable,
} from "rxjs"

import { logAndSwallow } from "../tools/logAndSwallow.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { LANGUAGE_TRIMMED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";
import { dirname, join } from "node:path";

type KeepSpecifiedLanguageTracksRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  filePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
}

type KeepSpecifiedLanguageTracksOptionalProps = {
  outputFolderName?: string
}

export type KeepSpecifiedLanguageTracksProps = KeepSpecifiedLanguageTracksRequiredProps & KeepSpecifiedLanguageTracksOptionalProps

export const keepSpecifiedLanguageTracksDefaultProps = {
  outputFolderName: LANGUAGE_TRIMMED_FOLDER_NAME,
} satisfies KeepSpecifiedLanguageTracksOptionalProps

export const keepSpecifiedLanguageTracks = ({
  audioLanguages,
  filePath,
  outputFolderName = keepSpecifiedLanguageTracksDefaultProps.outputFolderName,
  subtitlesLanguages,
}: KeepSpecifiedLanguageTracksProps): (
  Observable<
    string
  >
) => {
  const hasAudioLanguages = (
    (
      audioLanguages
      .length
    )
    > 0
  )

  const hasSubtitlesLanguages = (
    (
      subtitlesLanguages
      .length
    )
    > 0
  )

  return (
    runMkvMerge({
      args: [
        ...(
          hasAudioLanguages
          ? [
            "--audio-tracks",
            (
              audioLanguages
              .join(",")
            ),
          ]
          : []
        ),

        ...(
          hasSubtitlesLanguages
          ? [
            "--subtitle-tracks",
            (
              subtitlesLanguages
              .join(",")
            ),
          ]
          : []
        ),

        filePath,
      ],
      outputFilePath: (
        filePath
        .replace(
          (
            dirname(
              filePath
            )
          ),
          (
            join(
              (
                dirname(
                  filePath
                )
              ),
              outputFolderName,
            )
          ),
        )
      )
    })
    .pipe(
      logAndSwallow(
        keepSpecifiedLanguageTracks
      ),
    )
  )
}
