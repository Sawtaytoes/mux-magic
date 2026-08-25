import { existsSync } from "node:fs"
import { platform } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const isWindows = platform() === "win32"

// Anchor bundled-binary lookups to the repo root rather than process.cwd().
// CLI commands are routinely invoked from arbitrary media folders, so a
// cwd-relative path would always miss the bundle and silently fall back to
// PATH. From packages/api/src/tools/appPaths.ts the repo root is four
// levels up.
const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
)

const resolveAppPath = (
  relativePath: string,
  systemName: string,
) => {
  const absolutePath = resolve(repoRoot, relativePath)
  return isWindows && existsSync(absolutePath)
    ? absolutePath
    : systemName
}

/** @see https://github.com/bbc/audio-offset-finder */
// export const audioOffsetFinderPath = ".venv/bin/audio-offset-finder" // This local version doesn't run for whatever reason.
export const audioOffsetFinderPath = "audio-offset-finder"

// Chromaprint's fingerprinter, used by `fingerprintAudioFiles`. On Linux
// it comes from the `libchromaprint-tools` apt package the runtime image
// installs; on Windows it is the standalone release ZIP from
// github.com/acoustid/chromaprint, unpacked alongside the other bundled
// binaries.
export const fpcalcPath = resolveAppPath(
  "apps.downloaded/chromaprint/fpcalc.exe",
  "fpcalc",
)

export const ffmpegPath = resolveAppPath(
  "apps.downloaded/ffmpeg/bin/ffmpeg.exe",
  "ffmpeg",
)

// MediaInfo_CLI_25.03_Windows_x64
export const mediaInfoPath =
  process.env.MEDIAINFO_PATH ??
  resolveAppPath(
    "apps.downloaded/mediainfo/MediaInfo.exe",
    "mediainfo",
  )

// mkvtoolnix-64-bit-91.0
export const mkvExtractPath = resolveAppPath(
  "apps.downloaded/mkvtoolnix/mkvextract.exe",
  "mkvextract",
)

// mkvtoolnix-64-bit-91.0
export const mkvMergePath = resolveAppPath(
  "apps.downloaded/mkvtoolnix/mkvmerge.exe",
  "mkvmerge",
)

// mkvtoolnix-64-bit-91.0
export const mkvPropEditPath = resolveAppPath(
  "apps.downloaded/mkvtoolnix/mkvpropedit.exe",
  "mkvpropedit",
)

// Transplanted from ghcr.io/jlesage/makemkv into /opt/makemkv by the
// Dockerfile, which also puts it on PATH; on Windows MakeMKV installs to
// Program Files under its own name.
export const makeMkvConPath = resolveAppPath(
  "apps.downloaded/makemkv/makemkvcon64.exe",
  "makemkvcon",
)

// MakeMKV reads its registration key from `$HOME/.MakeMKV/settings.conf`.
// This is applied PER SPAWN rather than as an image-wide `ENV HOME`,
// because mux-magic also runs ffmpeg, mkvtoolnix, Playwright and a Python
// venv and moving HOME would relocate all of their state too. Unset
// outside the container, where the real HOME is already correct.
export const makeMkvHomePath =
  process.env.MUX_MAGIC_MAKEMKV_HOME ?? null

// Directory for server-owned persistent state (saved sequence templates,
// queued webhook deliveries from worker 2b, etc.). Defaults to ./.config
// which is gitignored. Override with the APP_DATA_DIR env var when running
// in Docker so the directory can live on a mounted volume that survives
// container restarts (e.g. `-v ./config:/app/.config` or
// `APP_DATA_DIR=/media/config`). The e2e harness also overrides this so
// parallel test workers each point at a disposable tmpdir.
//
// Single-process assumption: no inter-process locking. Concurrent writes
// from a second server pointed at the same directory will race —
// document and revisit if/when multi-process becomes a real requirement.
export const APP_DATA_DIR = resolve(
  process.env.APP_DATA_DIR ?? ".config",
)
