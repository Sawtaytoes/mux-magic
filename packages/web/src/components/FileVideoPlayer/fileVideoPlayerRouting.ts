// Pure routing/codec helpers for FileVideoPlayer. Extracted from the
// component so the decision logic is unit-testable (the component file is
// bound by the one-component-per-file rule and can't export helpers).
//
// Design + scope boundaries:
// docs/decisions/2026-06-30-seekable-transcode-video-player.md

// MediaInfo `Format` strings (lower-cased) that no major browser will
// decode in <video>. A source whose first audio track matches routes to
// /transcode/audio (Opus re-encode, video copied) instead of
// /files/stream.
export const BROWSER_UNSUPPORTED_AUDIO = new Set([
  "ac-3",
  "dts",
  "e-ac-3",
  "eac3",
  "mlp",
  "mlp fba",
  "pcm",
  "truehd",
])

// File extensions whose CONTAINER the browser cannot demux in <video>
// regardless of how browser-safe the codecs inside are — Matroska, AVI,
// MPEG-TS, etc. These always route to /transcode/audio (which remuxes to
// fragmented MP4) even when audio is browser-safe. Natively-playable
// containers (.mp4/.m4v/.webm/.mov/.ogg) are intentionally absent.
export const BROWSER_UNSUPPORTED_CONTAINER = new Set([
  ".avi",
  ".flv",
  ".m2ts",
  ".mkv",
  ".mpeg",
  ".mpg",
  ".ts",
  ".wmv",
])

// Server returns the full RFC 6381 codec string (e.g. "avc1.640029") in
// X-Video-Codec. This table only covers legacy/short responses that
// return just the base type.
const LEGACY_CODEC_FALLBACKS: Record<string, string> = {
  av01: "av01.0.08M.08", // AV1 Main 4:2:0
  avc1: "avc1.640029", // H.264 High@L4.1 — covers most Blu-ray rips
  hvc1: "hvc1.1.6.L150.B0", // H.265 Main@L5.0@High
}

export const getExtension = (path: string) => {
  const lastDot = path.lastIndexOf(".")
  return lastDot === -1
    ? ""
    : path.slice(lastDot).toLowerCase()
}

export const isAudioFormatBrowserSafe = (
  audioFormat: string | null,
) =>
  audioFormat === null ||
  audioFormat.length === 0 ||
  !BROWSER_UNSUPPORTED_AUDIO.has(audioFormat.toLowerCase())

export const isContainerBrowserSupported = (path: string) =>
  !BROWSER_UNSUPPORTED_CONTAINER.has(getExtension(path))

// True when the source must go through /transcode/audio to be playable:
// the container can't be demuxed natively OR the audio codec can't be
// decoded. `audioFormat` is the MediaInfo Format of the first audio track
// (null when unknown/unprobed → treated as browser-safe).
export const isTranscodeNeeded = ({
  audioFormat,
  path,
}: {
  audioFormat: string | null
  path: string
}) =>
  !isContainerBrowserSupported(path) ||
  !isAudioFormatBrowserSafe(audioFormat)

// Builds the MSE SourceBuffer mime from the HEAD X-Video-Codec header.
// Audio (Opus) is appended ONLY when the source actually has an audio
// track — a video-only file (e.g. a logo bumper) gets a video-only mime
// so the SourceBuffer doesn't expect an audio track that never arrives.
// Returns null when no usable video codec tag is available — the caller
// then degrades to a direct <video src>.
export const resolveTranscodeMimeType = (
  videoCodecTag: string | null,
  hasAudio: boolean,
): string | null => {
  const videoCodecFull = videoCodecTag?.includes(".")
    ? videoCodecTag
    : videoCodecTag
      ? LEGACY_CODEC_FALLBACKS[videoCodecTag]
      : undefined
  if (!videoCodecFull) {
    return null
  }
  const codecs = hasAudio
    ? `${videoCodecFull},opus`
    : videoCodecFull
  return `video/mp4; codecs="${codecs}"`
}
