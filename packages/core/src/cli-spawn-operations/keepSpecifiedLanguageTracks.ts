import { unlink } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import {
  logAndSwallowPipelineError,
  logError,
  logWarning,
} from "@mux-magic/tools"
import {
  concatMap,
  defaultIfEmpty,
  from,
  type Observable,
  of,
  throwError,
} from "rxjs"
import {
  getMkvInfo,
  type MkvInfo,
} from "../tools/getMkvInfo.js"
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

const countAudioTracks = (mkvInfo: MkvInfo | undefined) =>
  (mkvInfo?.tracks ?? []).filter(
    (track) => track.type === "audio",
  )

export const keepSpecifiedLanguageTracks = ({
  audioLanguages,
  filePath,
  outputFolderName = keepSpecifiedLanguageTracksDefaultProps.outputFolderName,
  subtitlesLanguages,
}: KeepSpecifiedLanguageTracksProps): Observable<string> => {
  const requestedAudioCodes = audioLanguages.map(
    (selection) => selection.code,
  )
  const hasAudioLanguages = requestedAudioCodes.length > 0

  const hasSubtitlesLanguages =
    subtitlesLanguages.length > 0

  const outputFilePath = filePath.replace(
    dirname(filePath),
    join(dirname(filePath), outputFolderName),
  )

  // Probe the SOURCE up front so the zero-audio guard can see every audio
  // track — including undefined/'und'-language tracks that `getTrackLanguages`
  // (MediaInfo) drops from language accounting. mkvmerge's --identify
  // normalizes a missing language to "und", so it is the reliable source of
  // truth for "how many audio tracks would survive an --audio-tracks filter".
  // getMkvInfo swallows its own errors -> EMPTY, so fall back to `undefined`
  // and merge as before (without the extra safety) rather than dropping the
  // file.
  return getMkvInfo(filePath).pipe(
    defaultIfEmpty(undefined as MkvInfo | undefined),
    concatMap((sourceInfo) => {
      const sourceAudioTracks = countAudioTracks(sourceInfo)
      const survivingAudioTrackCount =
        sourceAudioTracks.filter((track) =>
          requestedAudioCodes.includes(
            track.properties.language,
          ),
        ).length

      // Zero-audio guard (pre-check): if filtering to the requested audio
      // languages would strip EVERY audio track, drop the --audio-tracks
      // filter entirely and keep all original audio. A silent output is
      // never an acceptable trim result — this is the exact failure the
      // owner hits by hand (e.g. an English-native disc's French/Italian
      // featurette, or a track whose language tag is missing).
      const wouldRemoveAllAudio =
        hasAudioLanguages &&
        sourceAudioTracks.length > 0 &&
        survivingAudioTrackCount === 0

      if (wouldRemoveAllAudio) {
        logWarning(
          "KEEP LANGUAGES",
          `Requested audio languages ${JSON.stringify(
            requestedAudioCodes,
          )} are not present in "${filePath}" (has ${JSON.stringify(
            sourceAudioTracks.map(
              (track) => track.properties.language,
            ),
          )}); keeping all original audio to avoid a silent file.`,
        )
      }

      const useAudioFilter =
        hasAudioLanguages && !wouldRemoveAllAudio

      return runMkvMerge({
        args: [
          ...(useAudioFilter
            ? [
                "--audio-tracks",
                requestedAudioCodes.join(","),
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
        outputFilePath,
      }).pipe(
        // Zero-audio guard (post-write assertion): belt-and-suspenders behind
        // the pre-check. mkvmerge failures are otherwise swallowed, so verify
        // the produced file still carries audio when the source did. If it
        // doesn't, delete the silent output and fail this file rather than
        // leaving it on disk to be moved into the library.
        concatMap((producedPath) =>
          getMkvInfo(outputFilePath).pipe(
            defaultIfEmpty(
              undefined as MkvInfo | undefined,
            ),
            concatMap((outputInfo) => {
              const isZeroAudioRegression =
                outputInfo !== undefined &&
                sourceAudioTracks.length > 0 &&
                countAudioTracks(outputInfo).length === 0

              if (!isZeroAudioRegression) {
                return of(producedPath)
              }

              logError(
                "KEEP LANGUAGES",
                `Refusing to keep a zero-audio output for "${filePath}"; deleting "${outputFilePath}".`,
              )

              return from(unlink(outputFilePath)).pipe(
                concatMap(() =>
                  throwError(
                    () =>
                      new Error(
                        `keepLanguages produced a zero-audio file for "${filePath}"`,
                      ),
                  ),
                ),
              )
            }),
          ),
        ),
      )
    }),
    logAndSwallowPipelineError(keepSpecifiedLanguageTracks),
  )
}
