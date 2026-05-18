import { addFolderNameBeforeFilename } from "@mux-magic/tools"
import { concatMap, map, of } from "rxjs"
import { convertIso6391ToIso6392 } from "../tools/convertIso6391ToIso6392.js"
import type { Iso6391LanguageCode } from "../tools/iso6391LanguageCodes.js"
import { runMkvMerge } from "./runMkvMerge.js"

export const replacedTrackPath = "TRACK-REPLACED"

export const replaceTrackById = ({
  languageCode,
  sourceFilePath,
  trackId,
  trackReplacementFilePath,
}: {
  languageCode: Iso6391LanguageCode
  sourceFilePath: string
  trackId: string
  trackReplacementFilePath: string
}) =>
  of(
    addFolderNameBeforeFilename({
      filePath: sourceFilePath,
      folderName: replacedTrackPath,
    }),
  ).pipe(
    concatMap((outputFilePath) =>
      runMkvMerge({
        args: [
          sourceFilePath,

          // "--no-audio",

          // "--audio-tracks",

          "--language",
          `${trackId}:${convertIso6391ToIso6392(
            languageCode,
          )}`,

          trackReplacementFilePath,
        ],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
