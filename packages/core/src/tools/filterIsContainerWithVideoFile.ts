import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

// Sibling of filterIsLosslessAudioFile.ts. This filter matches container
// formats that can hold video tracks alongside audio. The convertLosslessToFlac
// command deliberately excludes these extensions because:
//   1. An .mkv or .mp4 in a music directory might have a real video track.
//   2. Silently dropping a video track via -vn would be data loss.
// This separate filter feeds findContainerAudioFiles and
// convertContainerAudioToFlac, both of which handle the video-track safety
// gate explicitly (via MediaInfo probing + the isVideoDropAcknowledged flag).
export const containerWithVideoFileExtensions = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".webm",
])

export const getIsContainerWithVideoFile = (
  sourceFilePath: string,
) =>
  containerWithVideoFileExtensions.has(
    extname(sourceFilePath).toLowerCase(),
  )

export const filterIsContainerWithVideoFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsContainerWithVideoFile(fileInfo.fullPath),
  )
