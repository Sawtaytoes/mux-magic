import { sep } from "node:path"
import {
  addFolderNameBeforeFilename,
  replaceFileExtension,
} from "@mux-magic/tools"
import { map } from "rxjs"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { EXTRACTED_SUBTITLES_FOLDER_NAME } from "../tools/outputFolderNames.js"
import {
  type SubtitleCodecId,
  subtitleExtensionByCodec,
} from "../tools/subtitleTypes.js"
import { runMkvExtract } from "./runMkvExtract.js"

export type ExtractSubtitleTrack = {
  codec_id: SubtitleCodecId
  languageCode: Iso6392LanguageCode | "und"
  trackId: number
}

type ExtractSubtitleTracksRequiredProps = {
  filePath: string
  tracks: ReadonlyArray<ExtractSubtitleTrack>
}

type ExtractSubtitleTracksOptionalProps = {
  outputFolderName?: string
}

export type ExtractSubtitleTracksProps =
  ExtractSubtitleTracksRequiredProps &
    ExtractSubtitleTracksOptionalProps

export const extractSubtitleTracksDefaultProps = {
  outputFolderName: EXTRACTED_SUBTITLES_FOLDER_NAME,
} satisfies ExtractSubtitleTracksOptionalProps

const buildOutputFilePath = ({
  filePath,
  outputFolderName,
  track,
}: {
  filePath: string
  outputFolderName: string
  track: ExtractSubtitleTrack
}) =>
  replaceFileExtension({
    filePath: addFolderNameBeforeFilename({
      filePath,
      folderName: outputFolderName,
    }),
    fileExtension: sep.concat(
      `track${track.trackId}`,
      ".",
      track.languageCode,
      ".",
      subtitleExtensionByCodec[track.codec_id],
    ),
  })

export const extractSubtitleTracks = ({
  filePath,
  outputFolderName = extractSubtitleTracksDefaultProps.outputFolderName,
  tracks,
}: ExtractSubtitleTracksProps) => {
  const outputs = tracks.map((track) => ({
    track,
    outputFilePath: buildOutputFilePath({
      filePath,
      outputFolderName,
      track,
    }),
  }))
  const outputFilePaths = outputs.map(
    ({ outputFilePath }) => outputFilePath,
  )
  const trackArgs = outputs.map(
    ({ track, outputFilePath }) =>
      `${track.trackId}:${outputFilePath}`,
  )
  return runMkvExtract({
    args: ["tracks", filePath].concat(trackArgs),
    outputFilePaths,
  }).pipe(map(() => outputFilePaths))
}
