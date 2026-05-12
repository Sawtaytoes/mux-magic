import { platform } from "node:os"
import ffmpegStaticPath from "ffmpeg-static"

const isWindows = platform() === "win32"

/** @see https://github.com/bbc/audio-offset-finder */
// export const audioOffsetFinderPath = ".venv/bin/audio-offset-finder" .// This local version doesn't run for whatever reason.
export const audioOffsetFinderPath = "audio-offset-finder"

export const ffmpegPath: string =
  (ffmpegStaticPath as unknown as string | null) ?? "ffmpeg"

// MediaInfo_CLI_25.03_Windows_x64
export const mediaInfoPath =
  process.env.MEDIAINFO_PATH ??
  (isWindows
    ? "assets.downloaded/mediainfo/MediaInfo.exe"
    : "mediainfo")

// mkvtoolnix-64-bit-91.0
export const mkvExtractPath = isWindows
  ? "assets.downloaded/mkvtoolnix/mkvextract.exe"
  : "mkvextract"

// mkvtoolnix-64-bit-91.0
export const mkvMergePath = isWindows
  ? "assets.downloaded/mkvtoolnix/mkvmerge.exe"
  : "mkvmerge"

// mkvtoolnix-64-bit-91.0
export const mkvPropEditPath = isWindows
  ? "assets.downloaded/mkvtoolnix/mkvpropedit.exe"
  : "mkvpropedit"
