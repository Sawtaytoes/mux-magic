import type { FileInfo } from "@mux-magic/tools"
import { map, type Observable } from "rxjs"
import {
  type AudioTrack,
  getMediaInfo,
} from "./getMediaInfo.js"

export type LosslessFlacSkipReason = "dsd" | "float-pcm"

export type GetIsLosslessFlacCompatibleResult =
  | { fileInfo: FileInfo; kind: "compatible" }
  | { kind: "skip"; reason: LosslessFlacSkipReason }

const getAudioTrack = (
  tracks: ReadonlyArray<{ "@type": string }>,
): AudioTrack | undefined =>
  tracks.find(
    (track): track is AudioTrack =>
      track["@type"] === "Audio",
  )

const getSkipReason = (
  audioTrack: AudioTrack,
): LosslessFlacSkipReason | undefined => {
  if (audioTrack.Format_Settings_Floating_Point === "Yes") {
    return "float-pcm"
  }
  if (audioTrack.Format.startsWith("DSD")) {
    return "dsd"
  }
  return undefined
}

// Probes one lossless-audio file with `getMediaInfo` and decides
// whether it can be losslessly re-encoded to FLAC. FLAC is integer-PCM
// only — a float WAV would be silently coerced by ffmpeg's flac
// encoder, and a DSD source can't be expressed in FLAC at all. Errors
// from `getMediaInfo` propagate as pipeline errors; we deliberately do
// NOT swallow them into a "skipped: unreadable" record because a louder
// failure is the more honest signal for a broken probe.
export const getIsLosslessFlacCompatible = (
  fileInfo: FileInfo,
): Observable<GetIsLosslessFlacCompatibleResult> =>
  getMediaInfo(fileInfo.fullPath).pipe(
    map((mediaInfo): GetIsLosslessFlacCompatibleResult => {
      const tracks = mediaInfo.media?.track ?? []
      const audioTrack = getAudioTrack(tracks)
      if (audioTrack === undefined) {
        return { fileInfo, kind: "compatible" }
      }
      const skipReason = getSkipReason(audioTrack)
      if (skipReason !== undefined) {
        return { kind: "skip", reason: skipReason }
      }
      return { fileInfo, kind: "compatible" }
    }),
  )
