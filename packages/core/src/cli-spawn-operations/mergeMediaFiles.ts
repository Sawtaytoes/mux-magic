import { concatMap, map, of } from "rxjs"

import { getOutputPath } from "../tools/getOutputPath.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const mergedMediaFilesFolderName = "MERGED-MEDIA"

export const mergeMediaFiles = ({
  filePaths,
  originalFilePath,
}: {
  filePaths: string[]
  originalFilePath: string
}) =>
  of(
    getOutputPath({
      filePath: originalFilePath,
      folderName: mergedMediaFilesFolderName,
    }),
  ).pipe(
    concatMap((outputFilePath) =>
      runMkvMerge({
        args: [
          ...filePaths
            .join("/+/")
            .split("/")
            .flatMap((filePath) =>
              filePath === "+"
                ? filePath
                : [
                    // "--no-attachments",
                    // "--no-audio",
                    // "--no-buttons",
                    // "--no-chapters",
                    // "--no-global-tags",
                    // "--no-subtitles",
                    // "--no-track-tags",
                    // "--no-video",

                    // "--audio-tracks",
                    // "1",

                    filePath,
                  ],
            ),
        ],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
