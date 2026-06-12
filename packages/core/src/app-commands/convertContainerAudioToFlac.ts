import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
  logWarning,
} from "@mux-magic/tools"
import {
  concatMap,
  EMPTY,
  map,
  type Observable,
  toArray,
} from "rxjs"
import { convertContainerAudioFileToFlac } from "../cli-spawn-operations/convertContainerAudioFileToFlac.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { filterIsContainerWithVideoFile } from "../tools/filterIsContainerWithVideoFile.js"
import { getMediaTrackSummary } from "../tools/getMediaTrackSummary.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ConvertContainerAudioToFlacRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type ConvertContainerAudioToFlacOptionalProps = {
  isSourceDeleted?: boolean
  isVideoDropAcknowledged?: boolean
}

export type ConvertContainerAudioToFlacProps =
  ConvertContainerAudioToFlacRequiredProps &
    ConvertContainerAudioToFlacOptionalProps

export type ConvertContainerAudioToFlacConvertedRecord = {
  destination: string
  isSourceDeleted: boolean
  kind: "converted"
  source: string
}

export type ConvertContainerAudioToFlacRecord =
  ConvertContainerAudioToFlacConvertedRecord

export const convertContainerAudioToFlacDefaultProps = {
  isSourceDeleted: false,
  isVideoDropAcknowledged: false,
} satisfies ConvertContainerAudioToFlacOptionalProps

// Encodes container audio tracks (from .mkv / .mp4 / .m4v / .mov / .webm / .avi)
// to FLAC in-place via ffmpeg -vn (drop video) + -c:a flac (or -c:a copy when
// already FLAC). Strictly lossless — no -ar, -ac, or -sample_fmt.
//
// Safety gate: if a file has a video track AND isVideoDropAcknowledged is
// false (the default), the file is skipped with a WARN log line and does NOT
// appear in the result set. Set isVideoDropAcknowledged: true after reviewing
// the findContainerAudioFiles report to convert those files.
//
// Files with no audio track are always refused (logged + silently skipped).
export const convertContainerAudioToFlac = ({
  isRecursive,
  isSourceDeleted = convertContainerAudioToFlacDefaultProps.isSourceDeleted,
  isVideoDropAcknowledged = convertContainerAudioToFlacDefaultProps.isVideoDropAcknowledged,
  sourcePath,
}: ConvertContainerAudioToFlacProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsContainerWithVideoFile(),
    withFileProgress(
      (fileInfo): Observable<ConvertContainerAudioToFlacRecord> =>
        getMediaInfo(fileInfo.fullPath).pipe(
          concatMap((mediaInfo) => {
            const summary = getMediaTrackSummary(
              fileInfo,
              mediaInfo,
            )

            if (summary.audioTrackCount === 0) {
              logWarning(
                "NO AUDIO TRACK — skipping",
                fileInfo.fullPath,
              )
              return EMPTY
            }

            if (
              summary.hasVideoTrack &&
              !isVideoDropAcknowledged
            ) {
              logWarning(
                "VIDEO PRESENT — skipping (set isVideoDropAcknowledged: true to convert)",
                fileInfo.fullPath,
              )
              return EMPTY
            }

            return convertContainerAudioFileToFlac({
              audioCodec: summary.audioCodec,
              filePath: fileInfo.fullPath,
              isSourceDeleted,
            }).pipe(
              map(
                (
                  destination,
                ): ConvertContainerAudioToFlacConvertedRecord => {
                  logInfo(
                    "CREATED FLAC FILE",
                    destination,
                  )
                  return {
                    destination,
                    isSourceDeleted,
                    kind: "converted",
                    source: fileInfo.fullPath,
                  }
                },
              ),
            )
          }),
        ),
    ),
    toArray(),
    logAndRethrowPipelineError(convertContainerAudioToFlac),
  )
