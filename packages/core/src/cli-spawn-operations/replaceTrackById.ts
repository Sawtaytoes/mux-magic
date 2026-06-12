import type { LanguageSelection } from "@mux-magic/api/src/api/languageSelection.js"
import { addFolderNameBeforeFilename } from "@mux-magic/tools"
import { concatMap, map, of } from "rxjs"
import { runMkvMerge } from "./runMkvMerge.js"

export const replacedTrackPath = "TRACK-REPLACED"

export const replaceTrackById = ({
  languageSelection,
  sourceFilePath,
  trackId,
  trackReplacementFilePath,
}: {
  languageSelection: LanguageSelection
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

          "--language",
          `${trackId}:${languageSelection.ietf ?? languageSelection.code}`,

          trackReplacementFilePath,
        ],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
