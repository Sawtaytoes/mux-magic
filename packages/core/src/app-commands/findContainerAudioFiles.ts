import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { map, toArray } from "rxjs"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { filterIsContainerWithVideoFile } from "../tools/filterIsContainerWithVideoFile.js"
import { getMediaTrackSummary } from "../tools/getMediaTrackSummary.js"
import type { MediaTrackSummary } from "../tools/getMediaTrackSummary.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export type FindContainerAudioFilesProps = {
  isRecursive: boolean
  sourcePath: string
}

export type FindContainerAudioFilesRecord = MediaTrackSummary

// Pure read — no filesystem mutation. Walks a directory for
// container-with-video extensions (.mkv / .mp4 / .m4v / .mov / .webm / .avi),
// probes each with MediaInfo, and returns a structured per-file track summary.
//
// Composable: the caller can run this first to identify which files have
// video tracks, then pass isVideoDropAcknowledged: true to
// convertContainerAudioToFlac for only the files they've vetted.
export const findContainerAudioFiles = ({
  isRecursive,
  sourcePath,
}: FindContainerAudioFilesProps) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsContainerWithVideoFile(),
    withFileProgress((fileInfo) =>
      getMediaInfo(fileInfo.fullPath).pipe(
        map((mediaInfo) =>
          getMediaTrackSummary(fileInfo, mediaInfo),
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(findContainerAudioFiles),
  )
