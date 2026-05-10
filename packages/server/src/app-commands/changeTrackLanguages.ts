import { concatMap, filter, from, map } from "rxjs"
import { updateTrackLanguage } from "../cli-spawn-operations/updateTrackLanguage.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import {
  getMkvInfo,
  type MkvTookNixTrackType,
} from "../tools/getMkvInfo.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const changeTrackLanguages = ({
  audioLanguage: selectedAudioLanguage,
  isRecursive,
  sourcePath,
  subtitlesLanguage: selectedSubtitlesLanguage,
  videoLanguage: selectedVideoLanguage,
}: {
  audioLanguage?: Iso6392LanguageCode
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguage?: Iso6392LanguageCode
  videoLanguage?: Iso6392LanguageCode
}) => {
  const trackTypeLanguageCode: Record<
    MkvTookNixTrackType,
    Iso6392LanguageCode | undefined
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
              Boolean(trackTypeLanguageCode[track.type]),
            ),
            concatMap((track) => {
              const languageCode =
                trackTypeLanguageCode[track.type]!
              const trackId = track.properties.number

              return updateTrackLanguage({
                filePath: fileInfo.fullPath,
                languageCode,
                trackId,
              }).pipe(
                // Emit a per-track record so job.results carries the
                // changes the run actually made — not a list of nulls
                // (runMkvPropEdit's path emission gets shadowed by the
                // outer toArray() void otherwise) and definitely not
                // a process.exit() that would bring down the API
                // server when this command runs from the API.
                map((updatedFilePath) => ({
                  filePath: updatedFilePath,
                  languageCode,
                  trackId,
                  trackType: track.type,
                })),
              )
            }),
          ),
        ),
      ),
    ),
    logAndRethrow(changeTrackLanguages),
  )
}
