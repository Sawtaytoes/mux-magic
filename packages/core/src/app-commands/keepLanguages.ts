import { join } from "node:path"
import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  makeDirectory,
} from "@mux-magic/tools"
import {
  concatMap,
  filter,
  from,
  map,
  tap,
  throwError,
  toArray,
} from "rxjs"
import {
  keepSpecifiedLanguageTracks,
  keepSpecifiedLanguageTracksDefaultProps,
} from "../cli-spawn-operations/keepSpecifiedLanguageTracks.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getTrackLanguages } from "../tools/getTrackLanguages.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type KeepLanguagesRequiredProps = {
  audioLanguages: LanguageSelection[]
  hasFirstAudioLanguage: boolean
  hasFirstSubtitlesLanguage: boolean
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguages: LanguageSelection[]
}

type KeepLanguagesOptionalProps = {
  outputFolderName?: string
}

export type KeepLanguagesProps =
  KeepLanguagesRequiredProps & KeepLanguagesOptionalProps

export const keepLanguagesDefaultProps = {
  outputFolderName:
    keepSpecifiedLanguageTracksDefaultProps.outputFolderName,
} satisfies KeepLanguagesOptionalProps

export const keepLanguages = ({
  audioLanguages: selectedAudioLanguages,
  isRecursive,
  hasFirstAudioLanguage,
  hasFirstSubtitlesLanguage,
  outputFolderName = keepLanguagesDefaultProps.outputFolderName,
  sourcePath,
  subtitlesLanguages: selectedSubtitlesLanguages,
}: KeepLanguagesProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    toArray(),
    concatMap((videoFiles) => {
      if (videoFiles.length === 0) {
        return throwError(
          () =>
            new Error(
              `No video files found in "${sourcePath}"`,
            ),
        )
      }
      return makeDirectory(
        join(sourcePath, outputFolderName),
      ).pipe(concatMap(() => from(videoFiles)))
    }),
    withFileProgress((fileInfo) =>
      getTrackLanguages(fileInfo.fullPath).pipe(
        map(({ audioLanguages, ...otherProps }) => ({
          ...otherProps,
          audioLanguages,
          hasMatchingAudioLanguage:
            selectedAudioLanguages.some(
              (selectedAudioLanguage) =>
                audioLanguages.includes(
                  selectedAudioLanguage.code,
                ),
            ),
        })),
        map(
          ({
            audioLanguages,
            hasMatchingAudioLanguage,
            subtitlesLanguages,
          }) => ({
            audioLanguages,
            audioLanguagesToKeep: [
              ...selectedAudioLanguages,
              ...(hasFirstAudioLanguage &&
              audioLanguages.length > 0
                ? [
                    {
                      code: audioLanguages.at(
                        0,
                      ) as Iso6392LanguageCode,
                    },
                  ]
                : hasMatchingAudioLanguage
                  ? []
                  : audioLanguages.map((code) => ({
                      code,
                    }))),
            ] as LanguageSelection[],
            subtitlesLanguages,
            subtitlesLanguagesToKeep: [
              ...selectedSubtitlesLanguages,
              ...(hasFirstSubtitlesLanguage &&
              subtitlesLanguages.length > 0
                ? [
                    {
                      code: subtitlesLanguages.at(
                        0,
                      ) as Iso6392LanguageCode,
                    },
                  ]
                : []),
            ] as LanguageSelection[],
          }),
        ),
        filter(
          ({
            audioLanguages,
            audioLanguagesToKeep,
            subtitlesLanguages,
            subtitlesLanguagesToKeep,
          }) =>
            audioLanguages.some(
              (audioLanguageCode) =>
                !audioLanguagesToKeep.some(
                  (selection) =>
                    selection.code === audioLanguageCode,
                ),
            ) ||
            subtitlesLanguages.some(
              (subtitlesLanguageCode) =>
                !subtitlesLanguagesToKeep.some(
                  (selection) =>
                    selection.code ===
                    subtitlesLanguageCode,
                ),
            ),
        ),
        concatMap(
          ({
            audioLanguagesToKeep,
            subtitlesLanguagesToKeep,
          }) =>
            keepSpecifiedLanguageTracks({
              audioLanguages: audioLanguagesToKeep,
              filePath: fileInfo.fullPath,
              outputFolderName,
              subtitlesLanguages: subtitlesLanguagesToKeep,
            }).pipe(
              tap(() => {
                logInfo(
                  "CREATED TRIMMED FILE",
                  fileInfo.fullPath,
                )
              }),
              filter(Boolean),
            ),
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(keepLanguages),
  )
