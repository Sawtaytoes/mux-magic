import {
  mkdir,
} from "node:fs/promises";
import {
  dirname,
} from "node:path"
import {
  concatMap,
  from,
  map,
  of,
} from "rxjs";

import { runMkvMerge } from "./runMkvMerge.js";
import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js";

import { REORDERED_TRACKS_FOLDER_NAME } from "../tools/outputFolderNames.js"

export const reorderTracksFolderName = REORDERED_TRACKS_FOLDER_NAME

export const reorderTracksMkvMerge = ({
  audioTrackIndexes,
  filePath,
  subtitlesTrackIndexes,
  videoTrackIndexes,
}: {
  audioTrackIndexes: number[]
  filePath: string
  subtitlesTrackIndexes: number[]
  videoTrackIndexes: number[]
}) => (
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: reorderTracksFolderName,
    })
  )
  .pipe(
    concatMap((
      outputFilePath,
    ) => (
      from(
        mkdir(
          (
            dirname(
              outputFilePath
            )
          ),
          { recursive: true },
        )
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
      runMkvMerge({
        args: [
          filePath,

          "--track-order",
          (
            videoTrackIndexes
            .map((
              videoTrackIndex,
            ) => (
              "0:"
              .concat(
                String(
                  videoTrackIndex
                )
              )
            ))
            .concat(
              audioTrackIndexes
              .map((
                audioTrackIndex,
              ) => (
                "0:"
                .concat(
                  String(
                    audioTrackIndex
                  )
                )
              ))
            )
            .concat(
              (
                subtitlesTrackIndexes
                .map((
                  subtitlesTrackIndex,
                ) => (
                  "0:"
                  .concat(
                    String(
                      subtitlesTrackIndex
                    )
                  )
                ))
              ),
            )
            .join(
              ","
            )
          ),
        ],
        outputFilePath,
      })
    )),
  )
)
