import type { FileInfo } from "@mux-magic/tools"
import type {
  AudioTrack,
  MediaInfo,
  VideoTrack,
} from "./getMediaInfo.js"

export type MediaTrackSummary = {
  audioCodec: string | null
  audioTrackCount: number
  filePath: string
  hasVideoTrack: boolean
  videoTrackCount: number
}

// Shared probe helper used by both findContainerAudioFiles and
// convertContainerAudioToFlac. Extracts track counts, the first audio codec,
// and the hasVideoTrack boolean from a MediaInfo result.
//
// The first audio track wins for audioCodec because multi-audio containers
// are out of scope (see 5a_container-audio-to-flac.md "Out of scope" section).
// Subtitle tracks and Menu tracks are ignored — they are irrelevant to the
// audio-to-FLAC workflow.
export const getMediaTrackSummary = (
  fileInfo: FileInfo,
  mediaInfo: MediaInfo,
): MediaTrackSummary => {
  const tracks = mediaInfo.media?.track ?? []

  const audioTracks = tracks.filter(
    (track): track is AudioTrack =>
      track["@type"] === "Audio",
  )
  const videoTracks = tracks.filter(
    (track): track is VideoTrack =>
      track["@type"] === "Video",
  )

  const firstAudioTrack = audioTracks[0]
  const audioCodec = firstAudioTrack?.Format ?? null

  return {
    audioCodec,
    audioTrackCount: audioTracks.length,
    filePath: fileInfo.fullPath,
    hasVideoTrack: videoTracks.length > 0,
    videoTrackCount: videoTracks.length,
  }
}
