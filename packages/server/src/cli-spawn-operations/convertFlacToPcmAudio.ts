import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { concatMap, from, map, of } from "rxjs"

import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js"
import { AUDIO_CONVERTED_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runFfmpeg } from "./runFfmpeg.js"

export const convertedPath = AUDIO_CONVERTED_FOLDER_NAME

export type AudioTrackInfo = {
  audioTrackIndex: number
  bitDepth: string
}

type ConvertFlacToPcmAudioRequiredProps = {
  audioTrackInfos: AudioTrackInfo[]
  filePath: string
}

type ConvertFlacToPcmAudioOptionalProps = {
  outputFolderName?: string
}

export type ConvertFlacToPcmAudioProps =
  ConvertFlacToPcmAudioRequiredProps &
    ConvertFlacToPcmAudioOptionalProps

export const convertFlacToPcmAudioDefaultProps = {
  outputFolderName: AUDIO_CONVERTED_FOLDER_NAME,
} satisfies ConvertFlacToPcmAudioOptionalProps

export const convertFlacToPcmAudio = ({
  audioTrackInfos,
  filePath,
  outputFolderName = convertFlacToPcmAudioDefaultProps.outputFolderName,
}: ConvertFlacToPcmAudioProps) =>
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: outputFolderName,
    }),
  ).pipe(
    concatMap((outputFilePath) =>
      from(
        mkdir(dirname(outputFilePath), { recursive: true }),
      ).pipe(map(() => outputFilePath)),
    ),
    concatMap((outputFilePath) =>
      runFfmpeg({
        args: [
          "-c",
          "copy",

          "-map",
          "0",

          ...audioTrackInfos.flatMap(
            ({ audioTrackIndex, bitDepth }) => [
              `-c:a:${audioTrackIndex}`,
              `pcm_s${bitDepth}le`,
            ],
          ),
        ],
        inputFilePaths: [filePath],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
