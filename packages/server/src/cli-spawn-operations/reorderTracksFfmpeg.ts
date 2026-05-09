import {
  mkdir,
} from "node:fs/promises"
import {
  dirname,
} from "node:path"
import {
  concatMap,
  from,
  map,
  of,
} from "rxjs";

import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js";
import { REORDERED_TRACKS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { runFfmpeg } from "./runFfmpeg.js";
import { makeDirectory } from "../tools/makeDirectory.js";

export const reorderedTracksPath = REORDERED_TRACKS_FOLDER_NAME

export type AudioTrackInfo = {
  audioTrackIndex: number
  bitDepth: string
}

type ReorderTracksFfmpegRequiredProps = {
  audioTrackIndexes: number[]
  filePath: string
  subtitlesTrackIndexes: number[]
  videoTrackIndexes: number[]
}

type ReorderTracksFfmpegOptionalProps = {
  outputFolderName?: string
}

export type ReorderTracksFfmpegProps = ReorderTracksFfmpegRequiredProps & ReorderTracksFfmpegOptionalProps

export const reorderTracksFfmpegDefaultProps = {
  outputFolderName: REORDERED_TRACKS_FOLDER_NAME,
} satisfies ReorderTracksFfmpegOptionalProps

export const reorderTracksFfmpeg = ({
  audioTrackIndexes,
  filePath,
  outputFolderName = reorderTracksFfmpegDefaultProps.outputFolderName,
  subtitlesTrackIndexes,
  videoTrackIndexes,
}: ReorderTracksFfmpegProps) => {
  const hasAudioTrackIndexes = (
    (
      audioTrackIndexes
      .length
    )
    > 0
  )

  const hasSubtitlesTrackIndexes = (
    (
      subtitlesTrackIndexes
      .length
    )
    > 0
  )

  const hasVideoTrackIndexes = (
    (
      videoTrackIndexes
      .length
    )
    > 0
  )

  return (
    of(
      addFolderNameBeforeFilename({
        filePath,
        folderName: outputFolderName,
      })
    )
    .pipe(
      concatMap((
        outputFilePath,
      ) => (
        makeDirectory(
          dirname(outputFilePath)
        )
        .pipe(
          map(() => (
            outputFilePath
          )),
        )
      )),
      concatMap((
        outputFilePath,
      ) => (
        runFfmpeg({
          args: [
            "-c",
            "copy",

            "-map",
            "0",

            ...(
              hasAudioTrackIndexes
              ? [
                "-map",
                "-0:a",
              ]
              : []
            ),

            ...(
              hasSubtitlesTrackIndexes
              ? [
                "-map",
                "-0:s",
              ]
              : []
            ),

            ...(
              hasVideoTrackIndexes
              ? [
                "-map",
                "-0:v",
              ]
              : []
            ),

            ...(
              audioTrackIndexes
              .flatMap((
                audioTrackIndex,
              ) => [
                "-map",
                `0:a:${audioTrackIndex}`,
              ])
            ),

            ...(
              subtitlesTrackIndexes
              .flatMap((
                subtitlesTrackIndex,
              ) => [
                "-map",
                `0:s:${subtitlesTrackIndex}`,
              ])
            ),

            ...(
              videoTrackIndexes
              .flatMap((
                videoTrackIndex,
              ) => [
                "-map",
                `0:v:${videoTrackIndex}`,
              ])
            ),
          ],
          inputFilePaths: [
            filePath
          ],
          outputFilePath,
        })
        .pipe(
          map(() => (
            outputFilePath
          )),
        )
      )),
    )
  )
}
