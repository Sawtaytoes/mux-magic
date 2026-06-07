import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, EMPTY, from, map, toArray } from "rxjs"
import {
  type ExtractSubtitleTrack,
  extractSubtitleTracks,
  extractSubtitleTracksDefaultProps,
} from "../cli-spawn-operations/extractSubtitleTracks.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import type { Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  getSubtitleExtensionForCodec,
  isKnownSubtitleCodecId,
  type SubtitleTypeExtension,
} from "../tools/subtitleTypes.js"

export type ExtractSubtitlesTypesMode =
  | "none"
  | "include"
  | "exclude"

type ExtractSubtitlesRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ExtractSubtitlesOptionalProps = {
  outputFolderName?: string
  subtitleTypes?: ReadonlyArray<SubtitleTypeExtension>
  subtitlesLanguages?: ReadonlyArray<Iso6392LanguageCode>
  typesMode?: ExtractSubtitlesTypesMode
}

export type ExtractSubtitlesProps =
  ExtractSubtitlesRequiredProps &
    ExtractSubtitlesOptionalProps

export const extractSubtitlesDefaultProps = {
  outputFolderName:
    extractSubtitleTracksDefaultProps.outputFolderName,
  subtitleTypes: [] as ReadonlyArray<SubtitleTypeExtension>,
  subtitlesLanguages:
    [] as ReadonlyArray<Iso6392LanguageCode>,
  typesMode: "none" as ExtractSubtitlesTypesMode,
} satisfies ExtractSubtitlesOptionalProps

const isLanguageMatch = ({
  subtitlesLanguages,
  trackLanguage,
}: {
  subtitlesLanguages: ReadonlyArray<Iso6392LanguageCode>
  trackLanguage: string
}) =>
  subtitlesLanguages.length === 0 ||
  subtitlesLanguages.includes(
    trackLanguage as Iso6392LanguageCode,
  )

const isTypeMatch = ({
  extension,
  subtitleTypes,
  typesMode,
}: {
  extension: SubtitleTypeExtension | undefined
  subtitleTypes: ReadonlyArray<SubtitleTypeExtension>
  typesMode: ExtractSubtitlesTypesMode
}) => {
  if (typesMode === "none") {
    return true
  }
  if (extension === undefined) {
    // Unknown codec while a type filter is active: by design, an
    // unknown codec can't be matched against a list of file extensions,
    // so skip it. The `none` branch above is where unknown codecs get
    // logged + extracted, matching the worker spec.
    return false
  }
  if (typesMode === "include") {
    return subtitleTypes.includes(extension)
  }
  return !subtitleTypes.includes(extension)
}

export const extractSubtitles = ({
  isRecursive,
  outputFolderName = extractSubtitlesDefaultProps.outputFolderName,
  sourcePath,
  subtitleTypes = extractSubtitlesDefaultProps.subtitleTypes,
  subtitlesLanguages = extractSubtitlesDefaultProps.subtitlesLanguages,
  typesMode = extractSubtitlesDefaultProps.typesMode,
}: ExtractSubtitlesProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      getMkvInfo(fileInfo.fullPath).pipe(
        concatMap(({ tracks }) => {
          const candidateTracks = tracks.filter(
            (track) =>
              track.type === "subtitles" &&
              isLanguageMatch({
                subtitlesLanguages,
                trackLanguage: String(
                  track.properties.language ?? "und",
                ),
              }),
          )
          const tracksWithExtension = candidateTracks
            .map((track) => {
              const codecId = String(
                track.properties.codec_id ?? "",
              )
              const extension =
                getSubtitleExtensionForCodec(codecId)
              if (
                extension === undefined &&
                typesMode === "none"
              ) {
                // Unknown codec on the "extract everything" path —
                // log it so users can grep for `SKIPPING UNKNOWN CODEC`
                // and decide whether to map it in subtitleTypes.ts.
                logInfo(
                  "SKIPPING UNKNOWN CODEC",
                  `${fileInfo.fullPath} (track ${track.properties.number}, ${codecId})`,
                )
              }
              return {
                codecId,
                extension,
                track,
              }
            })
            .filter(({ extension }) =>
              isTypeMatch({
                extension,
                subtitleTypes,
                typesMode,
              }),
            )
            .filter(({ codecId }) =>
              // typesMode === "none" still drops unknown-codec rows
              // here because the batched extractor has no extension
              // mapping for them — the log line above already noted
              // the skip.
              isKnownSubtitleCodecId(codecId),
            )
          if (tracksWithExtension.length === 0) {
            // No-subs case: log and skip the file rather than letting
            // the pipeline silently emit nothing. Avoids the "I got
            // an error but my file has no subs" confusion the user
            // reported when the runMkvExtract bug was tearing the SSE
            // stream down.
            logInfo("NO SUBTITLES", fileInfo.fullPath)
            return EMPTY
          }
          const extractionTracks: ReadonlyArray<ExtractSubtitleTrack> =
            tracksWithExtension.map(
              ({ codecId, track }) => ({
                codec_id:
                  codecId as ExtractSubtitleTrack["codec_id"],
                languageCode: track.properties.language,
                trackId: track.properties.number - 1,
              }),
            )
          return extractSubtitleTracks({
            filePath: fileInfo.fullPath,
            outputFolderName,
            tracks: extractionTracks,
          }).pipe(
            // Surface one record per extracted subtitle file. Without
            // this, the per-file value is `outputFilePaths` (a string[]),
            // so the job emits an array-of-arrays that the UI's per-item
            // results panel renders as nothing — the "completed but no
            // visible output" symptom. Flattening to `{ filePath }`
            // objects matches modifySubtitleMetadata's emission shape.
            concatMap((outputFilePaths) =>
              from(outputFilePaths),
            ),
            map((filePath) => ({ filePath })),
          )
        }),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(extractSubtitles),
  )
