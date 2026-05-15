import { existsSync } from "node:fs"
import { homedir, platform } from "node:os"
import { join } from "node:path"

const isWindows = platform() === "win32"

const resolveAppPath = (
  localPath: string,
  systemName: string,
): string =>
  isWindows && existsSync(localPath)
    ? localPath
    : systemName

/** @see https://github.com/bbc/audio-offset-finder */
// export const audioOffsetFinderPath = ".venv/bin/audio-offset-finder" // This local version doesn't run for whatever reason.
export const audioOffsetFinderPath = "audio-offset-finder"

export const ffmpegPath = resolveAppPath(
  "assets.downloaded/ffmpeg/bin/ffmpeg.exe",
  "ffmpeg",
)

// MediaInfo_CLI_25.03_Windows_x64
export const mediaInfoPath =
  process.env.MEDIAINFO_PATH ??
  resolveAppPath(
    "assets.downloaded/mediainfo/MediaInfo.exe",
    "mediainfo",
  )

// mkvtoolnix-64-bit-91.0
export const mkvExtractPath = resolveAppPath(
  "assets.downloaded/mkvtoolnix/mkvextract.exe",
  "mkvextract",
)

// mkvtoolnix-64-bit-91.0
export const mkvMergePath = resolveAppPath(
  "assets.downloaded/mkvtoolnix/mkvmerge.exe",
  "mkvmerge",
)

// mkvtoolnix-64-bit-91.0
export const mkvPropEditPath = resolveAppPath(
  "assets.downloaded/mkvtoolnix/mkvpropedit.exe",
  "mkvpropedit",
)

// Per-user writable directory for server-owned persistent state
// (saved sequence templates, queued webhook deliveries from worker 2b,
// etc.). Overridable via $APP_DATA_DIR so workers running e2e tests in
// parallel worktrees can each point at a disposable tmpdir without
// stepping on the real user data.
//
// Defaults:
//   • Windows: %APPDATA%\mux-magic       (e.g. C:\Users\u\AppData\Roaming\mux-magic)
//   • Other:    $XDG_DATA_HOME/mux-magic OR ~/.local/share/mux-magic
//
// Single-process assumption: no inter-process locking. Concurrent writes
// from a second server pointed at the same directory will race —
// document and revisit if/when multi-process becomes a real requirement.
const resolveAppDataDir = (): string => {
  const overridden = process.env.APP_DATA_DIR
  if (overridden && overridden.length > 0) return overridden

  if (isWindows) {
    const appData =
      process.env.APPDATA ??
      join(homedir(), "AppData", "Roaming")
    return join(appData, "mux-magic")
  }

  const xdgDataHome = process.env.XDG_DATA_HOME
  const dataHome =
    xdgDataHome && xdgDataHome.length > 0
      ? xdgDataHome
      : join(homedir(), ".local", "share")
  return join(dataHome, "mux-magic")
}

export const APP_DATA_DIR = resolveAppDataDir()
