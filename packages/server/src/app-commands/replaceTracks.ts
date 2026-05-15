import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  filter,
  map,
  of,
  tap,
  toArray,
} from "rxjs"
import { getAudioOffset } from "../cli-spawn-operations/getAudioOffset.js"
import {
  replaceTracksMkvMerge,
  replaceTracksMkvMergeDefaultProps,
} from "../cli-spawn-operations/replaceTracksMkvMerge.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReplaceTracksRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilesPath: string
  hasChapterSyncOffset: boolean
  hasChapters: boolean
  offsets: number[]
  sourcePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}

type ReplaceTracksOptionalProps = {
  globalOffsetInMilliseconds?: number
  outputFolderName?: string
}

export type ReplaceTracksProps =
  ReplaceTracksRequiredProps & ReplaceTracksOptionalProps

export const replaceTracksDefaultProps = {
  outputFolderName:
    replaceTracksMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceTracksOptionalProps

export const replaceTracks = ({
  audioLanguages,
  destinationFilesPath,
  globalOffsetInMilliseconds,
  hasChapterSyncOffset,
  hasChapters,
  offsets,
  outputFolderName = replaceTracksDefaultProps.outputFolderName,
  sourcePath,
  subtitlesLanguages,
  videoLanguages,
}: ReplaceTracksProps) =>
  getFilesAtDepth({
    depth: 0,
    sourcePath,
  }).pipe(
    toArray(),
    concatMap((sourceFileInfos) =>
      getFilesAtDepth({
        depth: 0,
        sourcePath: destinationFilesPath,
      }).pipe(
        map((destinationFileInfo) => ({
          destinationFilePath: destinationFileInfo.fullPath,
          sourceFilePath:
            sourceFileInfos.find(
              (sourceFileInfo) =>
                sourceFileInfo.filename ===
                destinationFileInfo.filename,
            )?.fullPath || "",
        })),
        filter(({ sourceFilePath }) =>
          Boolean(sourceFilePath),
        ),
        withFileProgress(
          (
            { destinationFilePath, sourceFilePath },
            index,
          ) =>
            (hasChapterSyncOffset
              ? getAudioOffset({
                  destinationFilePath,
                  sourceFilePath,
                })
              : of(globalOffsetInMilliseconds)
            ).pipe(
              tap((offsetInMilliseconds) => {
                logInfo(
                  "OFFSET IN MILLISECONDS",
                  offsetInMilliseconds,
                )
              }),
              concatMap((offsetInMilliseconds) =>
                replaceTracksMkvMerge({
                  audioLanguages,
                  destinationFilePath,
                  hasChapters,
                  offsetInMilliseconds:
                    offsets[index] ?? offsetInMilliseconds,
                  outputFolderName,
                  sourceFilePath,
                  subtitlesLanguages,
                  videoLanguages,
                }),
              ),
              tap((outputFilePath) => {
                logInfo(
                  "REPLACED TRACKS IN FILE",
                  outputFilePath,
                )
              }),
              filter(Boolean),
            ),
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(replaceTracks),
  )
