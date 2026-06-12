import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { concatMap, EMPTY, filter, from, map } from "rxjs"
import { updateTrackLanguage } from "../cli-spawn-operations/updateTrackLanguage.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  getMkvInfo,
  type MkvTookNixTrackType,
} from "../tools/getMkvInfo.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const changeTrackLanguages = ({
  audioLanguage: selectedAudioLanguage,
  isRecursive,
  sourcePath,
  subtitlesLanguage: selectedSubtitlesLanguage,
  videoLanguage: selectedVideoLanguage,
}: {
  audioLanguage?: LanguageSelection
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguage?: LanguageSelection
  videoLanguage?: LanguageSelection
}) => {
  const trackTypeLanguageSelection: Record<
    MkvTookNixTrackType,
    LanguageSelection | undefined
  > = {
    audio: selectedAudioLanguage,
    subtitles: selectedSubtitlesLanguage,
    video: selectedVideoLanguage,
  }

  return getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      getMkvInfo(fileInfo.fullPath).pipe(
        concatMap(({ tracks }) =>
          from(tracks).pipe(
            filter((track) =>
              Boolean(
                trackTypeLanguageSelection[track.type],
              ),
            ),
            concatMap((track) => {
              const languageSelection =
                trackTypeLanguageSelection[track.type]
              if (languageSelection == null) {
                return EMPTY
              }
              const trackId = track.properties.number

              return updateTrackLanguage({
                filePath: fileInfo.fullPath,
                languageSelection,
                trackId,
              }).pipe(
                map((updatedFilePath) => ({
                  filePath: updatedFilePath,
                  languageCode: languageSelection.code,
                  trackId,
                  trackType: track.type,
                })),
              )
            }),
          ),
        ),
      ),
    ),
    logAndRethrowPipelineError(changeTrackLanguages),
  )
}
