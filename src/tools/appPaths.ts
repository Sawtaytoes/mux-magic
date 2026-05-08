import { platform } from "node:os"
import { resolve as resolvePath } from "node:path"

const isWindows = platform() === 'win32'

/** @see https://github.com/bbc/audio-offset-finder */
// export const audioOffsetFinderPath = ".venv/bin/audio-offset-finder" .// This local version doesn't run for whatever reason.
export const audioOffsetFinderPath = "audio-offset-finder"

// 7.0.2-essentials_build
// Resolve to an absolute path on Windows so spawn callers that override
// `cwd` (e.g. runFfmpegAudioTranscode uses `cwd: os.tmpdir()`) can still
// find the binary. On Linux/macOS the bare `ffmpeg` is looked up via
// PATH, which works regardless of cwd.
export const ffmpegPath = (
  isWindows
  ? resolvePath("assets/ffmpeg/bin/ffmpeg.exe")
  : "ffmpeg"
)

// MediaInfo_CLI_25.03_Windows_x64
export const mediaInfoPath = (
  isWindows
  ? "assets/mediainfo/MediaInfo.exe"
  : "mediainfo"
)

// mkvtoolnix-64-bit-91.0
export const mkvExtractPath = (
  isWindows
  ? "assets/mkvtoolnix/mkvextract.exe"
  : "mkvextract"
)

// mkvtoolnix-64-bit-91.0
export const mkvMergePath = (
  isWindows
  ? "assets/mkvtoolnix/mkvmerge.exe"
  : "mkvmerge"
)

// mkvtoolnix-64-bit-91.0
export const mkvPropEditPath = (
  isWindows
  ? "assets/mkvtoolnix/mkvpropedit.exe"
  : "mkvpropedit"
)
