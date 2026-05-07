import {
  concatMap,
  filter,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getAudioOffset } from "../cli-spawn-operations/getAudioOffset.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { replaceTracksMkvMerge, replaceTracksMkvMergeDefaultProps } from "../cli-spawn-operations/replaceTracksMkvMerge.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReplaceTracksRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilesPath: string
  hasChapterSyncOffset: boolean
  hasChapters: boolean
  offsets: number[]
  sourceFilesPath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}

type ReplaceTracksOptionalProps = {
  globalOffsetInMilliseconds?: number
  outputFolderName?: string
}

export type ReplaceTracksProps = ReplaceTracksRequiredProps & ReplaceTracksOptionalProps

export const replaceTracksDefaultProps = {
  outputFolderName: replaceTracksMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceTracksOptionalProps

export const replaceTracks = ({
  audioLanguages,
  destinationFilesPath,
  globalOffsetInMilliseconds,
  hasChapterSyncOffset,
  hasChapters,
  offsets,
  outputFolderName = replaceTracksDefaultProps.outputFolderName,
  sourceFilesPath,
  subtitlesLanguages,
  videoLanguages,
}: ReplaceTracksProps) => (
  getFilesAtDepth({
    depth: 0,
    sourcePath: (
      sourceFilesPath
    ),
  })
  .pipe(
    toArray(),
    concatMap((
      sourceFileInfos,
    ) => (
      getFilesAtDepth({
        depth: 0,
        sourcePath: (
          destinationFilesPath
        ),
      })
      .pipe(
        map((
          destinationFileInfo,
        ) => ({
          destinationFilePath: (
            destinationFileInfo
            .fullPath
          ),
          sourceFilePath: (
            (
              sourceFileInfos
              .find((
                sourceFileInfo,
              ) => (
                (
                  sourceFileInfo
                  .filename
                )
                === (
                  destinationFileInfo
                  .filename
                )
              ))
              ?.fullPath
            )
            || ""
          ),
        })),
        filter(({
          sourceFilePath,
        }) => (
          Boolean(
            sourceFilePath
          )
        )),
        withFileProgress((
          {
            destinationFilePath,
            sourceFilePath,
          },
          index,
        ) => (
          (
            hasChapterSyncOffset
            ? (
              getAudioOffset({
                destinationFilePath,
                sourceFilePath,
              })
            )
            : (
              of(
                globalOffsetInMilliseconds
              )
            )
          )
          .pipe(
            tap((
              offsetInMilliseconds,
            ) => {
              logInfo(
                "OFFSET IN MILLISECONDS",
                offsetInMilliseconds,
              )
            }),
            concatMap((
              offsetInMilliseconds,
            ) => (
              replaceTracksMkvMerge({
                audioLanguages,
                destinationFilePath,
                hasChapters,
                offsetInMilliseconds: (
                  (
                    offsets
                    [index]
                  )
                  ?? (
                    offsetInMilliseconds
                  )
                ),
                outputFolderName,
                sourceFilePath,
                subtitlesLanguages,
                videoLanguages,
              })
            )),
            tap((
              outputFilePath,
            ) => {
              logInfo(
                "REPLACED TRACKS IN FILE",
                outputFilePath,
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
      replaceTracks
    ),
  )
)
