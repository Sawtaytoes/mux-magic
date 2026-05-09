import { isAbsolute, normalize, sep } from "node:path"

// Path-safety helper shared across the file-explorer endpoints
// (list / stream / delete). The endpoints accept arbitrary paths from
// the client, so every path that crosses an API boundary needs:
//
//   1. Absolute-path validation — reject `relative/segments`.
//   2. Normalization + traversal rejection — block `..` after normalize
//      so a client can't list/stream/delete `C:\Users\..\Windows\System32`.
//
// Deletes additionally trust the global DELETE_TO_TRASH setting (handled
// in deleteFiles.ts) — when trash is on, the OS Recycle Bin is the
// recovery story; when off, the operator has explicitly opted into
// permanent deletes (e.g. Docker-on-ZFS where the OS trash isn't useful
// and the user has filesystem snapshots as the recovery story).

export class PathSafetyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PathSafetyError"
  }
}

// Returns the path normalized and validated. Throws PathSafetyError on
// anything that's not an absolute, traversal-free path.
export const validateReadablePath = (path: string): string => {
  if (typeof path !== "string" || path.length === 0) {
    throw new PathSafetyError("Path is required")
  }
  if (!isAbsolute(path)) {
    throw new PathSafetyError(`Path must be absolute: ${path}`)
  }
  const normalized = normalize(path)
  // After normalize, a leading `..` (or one mid-path that survives) means
  // the input had traversal that bubbled past the root. Belt-and-braces
  // check — Node's normalize already collapses most cases, but a
  // pathological `\\..\\` on Windows can still slip through.
  if (normalized.split(sep).some((segment) => segment === "..")) {
    throw new PathSafetyError(`Path traversal not allowed: ${path}`)
  }
  return normalized
}

// The single allowed media root for the /transcode/* endpoints. Hardcoded
// (not env-var) per `docs/options/ffmpeg-audio-reencode-endpoint.md` §12.
// Operators must mount their media at this path inside the server
// container. The README explains the requirement to end-users.
export const MEDIA_ROOT = "/media"

// Returns the path normalized + validated under MEDIA_ROOT. Throws
// PathSafetyError when the input is not absolute, contains traversal,
// or normalizes to anything outside MEDIA_ROOT. Wraps validateReadablePath
// so callers get one consistent error type.
export const validateMediaPath = (path: string): string => {
  const normalized = validateReadablePath(path)
  // POSIX-style comparison — MEDIA_ROOT is hardcoded as "/media", so the
  // normalized path must either equal it or live inside it. The trailing
  // separator on the prefix prevents "/media-other/..." from sneaking past
  // a startsWith check.
  const rootWithSeparator = (
    MEDIA_ROOT.endsWith(sep) || MEDIA_ROOT.endsWith("/")
  )
  ? MEDIA_ROOT
  : `${MEDIA_ROOT}/`
  if (
    normalized !== MEDIA_ROOT
    && !normalized.startsWith(rootWithSeparator)
    && !normalized.startsWith(`${MEDIA_ROOT}${sep}`)
  ) {
    throw new PathSafetyError(
      `Path is outside the allowed media root (${MEDIA_ROOT}): ${path}`,
    )
  }
  return normalized
}
