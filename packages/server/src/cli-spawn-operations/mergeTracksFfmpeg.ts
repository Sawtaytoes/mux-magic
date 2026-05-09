import {
  dirname,
  join,
} from "node:path"
import {
  concatMap,
  endWith,
} from "rxjs";

import { runFfmpeg } from "./runFfmpeg.js";
import { defineLanguageForUndefinedTracks } from "./defineLanguageForUndefinedTracks.js";

export const mergedPath = "MERGED"

export const mergeTracksFfmpeg = ({
  attachmentFilePaths,
  destinationFilePath,
  fileSizeInKilobytes,
  inputFilePaths,
  // offsetInMilliseconds,
}: {
  attachmentFilePaths?: string[]
  destinationFilePath: string
  fileSizeInKilobytes: number
  inputFilePaths: string[]
  // offsetInMilliseconds?: number
}) => (
  runFfmpeg({
    args: [
      "-c:v",
      "copy",

      "-c:a",
      "copy",

      "-c:s",
      "copy",

      "-c:d",
      "copy",
    ],
    // attachmentFilePaths,
    // fileSizeInKilobytes,
    inputFilePaths,
    outputFilePath: (
      destinationFilePath
      .replace(
        (
          dirname(
            destinationFilePath
          )
        ),
        (
          join(
            (
              dirname(
                destinationFilePath
              )
            ),
            mergedPath,
          )
        ),
      )
    )
  })
  .pipe(
    concatMap(() => (
      defineLanguageForUndefinedTracks({
        filePath: destinationFilePath,
        subtitleLanguage: "eng",
        trackType: "subtitles",
      })
      .pipe(
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(
          null
        ),
      )
    ))
  )
)
