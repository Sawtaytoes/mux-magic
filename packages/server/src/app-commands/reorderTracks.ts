import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { concatMap, EMPTY, map, toArray } from "rxjs"
import {
  reorderTracksFfmpeg,
  reorderTracksFfmpegDefaultProps,
} from "../cli-spawn-operations/reorderTracksFfmpeg.js"
import { setOnlyFirstTracksAsDefault } from "../cli-spawn-operations/setOnlyFirstTracksAsDefault.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ReorderTracksRequiredProps = {
  audioTrackIndexes: number[]
  isRecursive: boolean
  sourcePath: string
  subtitlesTrackIndexes: number[]
  videoTrackIndexes: number[]
}

type ReorderTracksOptionalProps = {
  outputFolderName?: string
}

export type ReorderTracksProps =
  ReorderTracksRequiredProps & ReorderTracksOptionalProps

export const reorderTracksDefaultProps = {
  outputFolderName:
    reorderTracksFfmpegDefaultProps.outputFolderName,
} satisfies ReorderTracksOptionalProps

export const reorderTracks = ({
  audioTrackIndexes,
  isRecursive,
  outputFolderName = reorderTracksDefaultProps.outputFolderName,
  sourcePath,
  subtitlesTrackIndexes,
  videoTrackIndexes,
}: ReorderTracksProps) => {
  // No-op fast path so the YAML pipeline can include reorderTracks
  // unconditionally — the conditional 'should we reorder?' decision lives
  // in the caller's input arrays, not in branching that has to live in
  // the sequence YAML.
  const hasNoTrackIndexes =
    (!audioTrackIndexes ||
      audioTrackIndexes.length === 0) &&
    (!subtitlesTrackIndexes ||
      subtitlesTrackIndexes.length === 0) &&
    (!videoTrackIndexes || videoTrackIndexes.length === 0)
  if (hasNoTrackIndexes) {
    logInfo(
      "REORDER TRACKS",
      "No track indexes provided — skipping (no-op).",
    )
    return EMPTY
  }

  return getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    // Per-file: reorder via ffmpeg, then re-anchor the default tracks
    // on the reordered output. Emit a { sourceFilePath, outputFilePath }
    // record once both inner steps complete so job.results lists every
    // file that was actually reordered (instead of an array of nulls
    // from the discarded toArray of the inner setOnlyFirst pipe).
    withFileProgress((fileInfo) =>
      reorderTracksFfmpeg({
        audioTrackIndexes,
        filePath: fileInfo.fullPath,
        outputFolderName,
        subtitlesTrackIndexes,
        videoTrackIndexes,
      })
        // To do this with `mkvmerge`, tracks need to be numbered sequentially
        // from video to audio to subtitles. It's more complicated and not as
        // easy to replicate. Only use this if something is botched with `ffmpeg`.
        .pipe(
          concatMap((outputFilePath) =>
            setOnlyFirstTracksAsDefault({
              filePath: outputFilePath,
            }).pipe(
              toArray(),
              map(() => ({
                outputFilePath,
                sourceFilePath: fileInfo.fullPath,
              })),
            ),
          ),
        ),
    ),
    logAndRethrowPipelineError(reorderTracks),
  )
}
