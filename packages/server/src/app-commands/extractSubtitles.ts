import {
  concatMap,
  EMPTY,
  filter,
  from,
  toArray,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { extractSubtitleTrack, extractSubtitleTrackDefaultProps } from "../cli-spawn-operations/extractSubtitleTrack.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { withFileProgress } from "../tools/progressEmitter.js"

// Image-format subtitle codecs. mkvextract can pull them but the
// resulting binary file (e.g. .sup) isn't useful for downstream
// modifySubtitleMetadata-style processing — it's pixels, not text.
// Skip them so the rest of the file's tracks still extract and the
// user gets a clear log line they can grep for.
const IMAGE_SUBTITLE_CODECS = new Set<string>([
  "S_HDMV/PGS",
  "S_HDMV/TEXTST",
  "S_VOBSUB",
])

type ExtractSubtitlesRequiredProps = {
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguage?: Iso6392LanguageCode
}

type ExtractSubtitlesOptionalProps = {
  outputFolderName?: string
}

export type ExtractSubtitlesProps = ExtractSubtitlesRequiredProps & ExtractSubtitlesOptionalProps

export const extractSubtitlesDefaultProps = {
  outputFolderName: extractSubtitleTrackDefaultProps.outputFolderName,
} satisfies ExtractSubtitlesOptionalProps

export const extractSubtitles = ({
  isRecursive,
  outputFolderName = extractSubtitlesDefaultProps.outputFolderName,
  sourcePath,
  subtitlesLanguage,
}: ExtractSubtitlesProps) => (
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) => (
      getMkvInfo(fileInfo.fullPath)
      .pipe(
        concatMap(({ tracks }) => {
          const subtitleTracks = tracks.filter((track) => (
            track.type === "subtitles"
            && (subtitlesLanguage ? track.properties.language === subtitlesLanguage : true)
          ))
          // No-subs case: log and skip the file rather than letting the
          // pipeline silently emit nothing. Avoids the "I got an error
          // but my file has no subs" confusion the user reported when
          // the runMkvExtract bug was tearing the SSE stream down.
          if (subtitleTracks.length === 0) {
            logInfo("NO SUBTITLES", fileInfo.fullPath)
            return EMPTY
          }
          return (
            from(subtitleTracks)
            .pipe(
              filter((track) => {
                const codecId = String(track.properties.codec_id ?? "")
                if (IMAGE_SUBTITLE_CODECS.has(codecId)) {
                  logInfo(
                    "SKIPPING IMAGE SUBTITLES",
                    `${fileInfo.fullPath} (track ${track.properties.number}, ${codecId}) — `
                    + `${codecId} is an image-based subtitle format (pixels, not text), so extracting it would produce a binary .sup/.sub file that downstream text-based steps like modifySubtitleMetadata can't read. `
                    + `If every track on every file is an image format, this command will complete with no extracted output — that's expected, not a failure. `
                    + `Use mkvextract directly if you need the raw image subs for OCR or an external tool.`,
                  )
                  return false
                }
                return true
              }),
              concatMap((track) => (
                extractSubtitleTrack({
                  codec_id: (
                    track.properties.codec_id as Parameters<typeof extractSubtitleTrack>[0]["codec_id"]
                  ),
                  filePath: fileInfo.fullPath,
                  languageCode: track.properties.language,
                  outputFolderName,
                  trackId: track.properties.number - 1,
                })
              )),
            )
          )
        }),
      )
    )),
    toArray(),
    logAndRethrow(extractSubtitles),
  )
)
