import {
  concatMap,
  filter,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { convertFlacToPcmAudio, convertFlacToPcmAudioDefaultProps } from "../cli-spawn-operations/convertFlacToPcmAudio.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  getMediaInfo,
  type AudioTrack,
} from "../tools/getMediaInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReplaceFlacWithPcmAudioRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ReplaceFlacWithPcmAudioOptionalProps = {
  outputFolderName?: string
}

export type ReplaceFlacWithPcmAudioProps = ReplaceFlacWithPcmAudioRequiredProps & ReplaceFlacWithPcmAudioOptionalProps

export const replaceFlacWithPcmAudioDefaultProps = {
  outputFolderName: convertFlacToPcmAudioDefaultProps.outputFolderName,
} satisfies ReplaceFlacWithPcmAudioOptionalProps

export const replaceFlacWithPcmAudio = ({
  isRecursive,
  outputFolderName = replaceFlacWithPcmAudioDefaultProps.outputFolderName,
  sourcePath,
}: ReplaceFlacWithPcmAudioProps) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? 1
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) => (
      getMediaInfo(
        fileInfo
        .fullPath
      )
      .pipe(
        filter(
          Boolean
        ),
        map(({
          media,
        }) => (
          media
        )),
        filter(
          Boolean
        ),
        concatMap(({
          track,
        }) => (
          track
        )),
        filter((
          track,
        ): track is AudioTrack => (
          (
            (
              track
              ["@type"]
            )
            === "Audio"
          )
        )),
        concatMap((
          track,
          index,
        ) => (
          of({
            audioTrackIndex: (
              index
            ),
            bitDepth: (
              track
              .BitDepth!
            ),
          })
          .pipe(
            filter(() => (
              (
                track
                .Format
              )
              === "FLAC"
            )),
          )
        )),
        toArray(),
        concatMap((
          audioTrackInfos,
        ) => (
          convertFlacToPcmAudio({
            audioTrackInfos,
            filePath: (
              fileInfo
              .fullPath
            ),
            outputFolderName,
          })
        )),
      )
      .pipe(
        tap(() => {
          logInfo(
            "CREATED PCM AUDIO CONVERSION FILE",
            (
              fileInfo
              .fullPath
            ),
          )
        }),
        filter(
          Boolean
        ),
      )
    )),
    toArray(),
    logAndRethrow(
      replaceFlacWithPcmAudio
    ),
  )
)
