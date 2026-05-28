import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  runTask,
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
  hasAudioSyncOffset: boolean
  hasChapters: boolean
  offsets: number[]
  sourcePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}

type ReplaceTracksOptionalProps = {
  globalOffsetInMilliseconds?: number
  isOverwritingExtractedAudio?: boolean
  outputFolderName?: string
}

export type ReplaceTracksProps =
  ReplaceTracksRequiredProps & ReplaceTracksOptionalProps

export const replaceTracksDefaultProps = {
  isOverwritingExtractedAudio: false,
  outputFolderName:
    replaceTracksMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceTracksOptionalProps

export const replaceTracks = ({
  audioLanguages,
  destinationFilesPath,
  globalOffsetInMilliseconds,
  hasAudioSyncOffset,
  hasChapters,
  isOverwritingExtractedAudio = replaceTracksDefaultProps.isOverwritingExtractedAudio,
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
            (hasAudioSyncOffset
              ? getAudioOffset({
                  destinationFilePath,
                  isOverwritingExtractedAudio,
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
                // mkvmerge is the second IO-heavy phase per file
                // (after the optional audio-offset analysis). It gets
                // its own scheduler slot — same reasoning as the
                // runTask wraps inside getAudioOffset. The outer
                // iteration below opts out via isOuterScheduled: false
                // so this inner slot can actually be granted.
                runTask(
                  replaceTracksMkvMerge({
                    audioLanguages,
                    destinationFilePath,
                    hasChapters,
                    offsetInMilliseconds:
                      offsets[index] ??
                      offsetInMilliseconds,
                    outputFolderName,
                    sourceFilePath,
                    subtitlesLanguages,
                    videoLanguages,
                  }),
                ),
              ),
              tap((outputFilePath) => {
                logInfo(
                  "REPLACED TRACKS IN FILE",
                  outputFilePath,
                )
              }),
              filter(Boolean),
            ),
          // Per-file work below contains its own runTask wraps
          // (getAudioOffset's ffmpegs + offset finder, and the
          // mkvmerge above). The outer iteration must stay
          // unscheduled to avoid the double-scheduling deadlock.
          { isOuterScheduled: false },
        ),
        toArray(),
      ),
    ),
    logAndRethrowPipelineError(replaceTracks),
  )
