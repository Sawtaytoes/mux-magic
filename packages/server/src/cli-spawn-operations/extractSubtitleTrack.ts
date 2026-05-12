import { sep } from "node:path"
import { concatMap, map, of } from "rxjs"

import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js"
import type { subtitlesFileExtensions } from "../tools/filterIsSubtitlesFile.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { EXTRACTED_SUBTITLES_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { replaceFileExtension } from "../tools/replaceFileExtension.js"
import { runMkvExtract } from "./runMkvExtract.js"

export const subtitleCodecExtension = {
  "S_HDMV/PGS": ".sup",
  "S_TEXT/ASS": ".ass",
  "S_TEXT/UTF8": ".srt",
} as const satisfies Record<
  string,
  (typeof subtitlesFileExtensions)[number]
>

type ExtractSubtitleTrackRequiredProps = {
  codec_id: keyof typeof subtitleCodecExtension
  filePath: string
  languageCode: Iso6392LanguageCode | "und"
  trackId: number
}

type ExtractSubtitleTrackOptionalProps = {
  outputFolderName?: string
}

export type ExtractSubtitleTrackProps =
  ExtractSubtitleTrackRequiredProps &
    ExtractSubtitleTrackOptionalProps

export const extractSubtitleTrackDefaultProps = {
  outputFolderName: EXTRACTED_SUBTITLES_FOLDER_NAME,
} satisfies ExtractSubtitleTrackOptionalProps

export const extractSubtitleTrack = ({
  codec_id,
  filePath,
  languageCode,
  outputFolderName = extractSubtitleTrackDefaultProps.outputFolderName,
  trackId,
}: ExtractSubtitleTrackProps) =>
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: outputFolderName,
    }),
  ).pipe(
    map((outputFilePath) =>
      replaceFileExtension({
        filePath: outputFilePath,
        fileExtension: sep.concat(
          `track${trackId}`,
          ".",
          languageCode,
          subtitleCodecExtension[codec_id],
        ),
      }),
    ),
    concatMap((outputFilePath) =>
      runMkvExtract({
        args: [
          "tracks",
          filePath,
          `${trackId}:${outputFilePath}`,
        ],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
