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

// MediaInfo signals float-PCM via different audio-track fields
// depending on the WAV's RIFF chunk variant and MediaInfo version:
//   - `Format_Settings_Floating_Point: "Yes"` — WAVE_FORMAT_EXTENSIBLE
//     (cIEEEFloat sub-format tag) on older MediaInfo builds.
//   - `Format_Profile: "Float"` — plain WAVE_FORMAT_IEEE_FLOAT
//     ("PcmWaveformat") container, especially on MediaInfo 26+.
// Either is authoritative; we accept both. `BitDepth: "32"` alone is
// NOT a float signal (32-bit integer WAVs are valid and FLAC-encodable).
//
// MediaInfo signals DSD via the audio-track Format string itself:
//   - "DSD" — uncompressed DSD (DSF, uncompressed DSDIFF). Rate is in
//     SamplingRate (2822400 = DSD64, 5644800 = DSD128, etc.) — there
//     is no "DSD64" / "DSD128" Format variant.
//   - "DST" — Direct Stream Transfer, lossless compression of DSD
//     inside DSDIFF (.dff). FLAC cannot represent DST any more than
//     it can represent raw DSD.
// DSD-over-PCM (DoP) is deliberately indistinguishable from normal
// 24-bit PCM at MediaInfo level and is out of scope for this probe.
const dsdFormats = new Set(["DSD", "DST"])

const getSkipReason = (
  audioTrack: AudioTrack,
): LosslessFlacSkipReason | undefined => {
  if (audioTrack.Format_Settings_Floating_Point === "Yes") {
    return "float-pcm"
  }
  if (audioTrack.Format_Profile === "Float") {
    return "float-pcm"
  }
  if (dsdFormats.has(audioTrack.Format)) {
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
