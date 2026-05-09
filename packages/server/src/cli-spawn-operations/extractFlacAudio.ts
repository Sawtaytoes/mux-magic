import {
  concatMap,
  map,
  of,
} from "rxjs";

import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js";
import { convertIso6391ToIso6392 } from "../tools/convertIso6391ToIso6392.js";
import { type Iso6391LanguageCode } from "../tools/iso6391LanguageCodes.js";
import { replaceFileExtension } from "../tools/replaceFileExtension.js";
import { runMkvExtract } from "./runMkvExtract.js";

export const extractedPath = "EXTRACTED-FLAC-AUDIO"

export const extractFlacAudio = ({
  filePath,
  languageCode,
  trackId,
}: {
  filePath: string
  languageCode: Iso6391LanguageCode,
  trackId: string,
}) => (
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: extractedPath,
    })
  )
  .pipe(
    map((
      outputFilePath,
    ) => (
      replaceFileExtension({
        filePath: outputFilePath,
        fileExtension: (
          convertIso6391ToIso6392(
            languageCode
          )
          .concat(
            ".flac"
          )
        ),
      })
    )),
    concatMap((
      outputFilePath,
    ) => (
      runMkvExtract({
        args: [
          "tracks",
          filePath,
          `${trackId}:${outputFilePath}`,
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
