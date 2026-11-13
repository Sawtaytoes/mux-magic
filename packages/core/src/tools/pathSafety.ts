import {
  delimiter,
  isAbsolute,
  normalize,
  relative,
  sep,
  win32,
} from "node:path"

import {
  getCwd,
  getPlatform,
} from "./currentEnvironment.js"

// Path-safety helper shared across the file-explorer endpoints
// (list / stream / delete). The endpoints accept arbitrary paths from
// the client, so every path that crosses an API boundary needs:
//
//   1. Absolute-path validation — reject `relative/segments`.
//   2. Traversal rejection — block a raw `..` segment before normalize
//      so a client can't list/stream/delete `C:\Users\..\Windows\System32`.
//   3. For routes that change files, containment under the allowed file
//      roots (validateWritablePath).
//
// Deletes additionally trust the global DELETE_MODE setting (handled
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

// Platform-injectable check that requires a fully qualified path on
// Windows — either drive-qualified (`C:\…`) or a UNC share
// (`\\\\server\\share\\…`). Bare POSIX-style paths (`/work`, `/home/foo`)
// are rejected because Node's `isAbsolute` returns `true` for them on
// win32, but at the syscall layer they're drive-relative —
// `fs.mkdirSync("/work")` silently anchors to whatever drive the dev
// server is running from. The detection uses `win32.parse(p).root ===
// "/"` (drive-qualified roots are `"C:\\"`, UNC roots are
// `"\\\\server\\share\\"`, neither match). Using `win32.parse` instead
// of `path.parse` keeps the helper testable on Linux CI without
// monkey-patching the runner's actual `process.platform`. No-op on
// non-Windows platforms — POSIX absolute paths stay legitimate there.
export const validateWindowsAbsolutePath = ({
  cwd,
  path,
  platform,
}: {
  cwd: string
  path: string
  platform: NodeJS.Platform
}) => {
  if (
    platform === "win32" &&
    win32.parse(path).root === "/"
  ) {
    const cwdDriveRoot = win32
      .parse(cwd)
      .root.replace(/[\\/]+$/, "")
    const suggestedPath = `${cwdDriveRoot}${path.replace(/\//g, "\\")}`
    throw new PathSafetyError(
      `Path "${path}" is drive-relative on Windows — it would silently anchor to "${cwdDriveRoot}" (the dev server's current drive). Use a fully qualified path like "${suggestedPath}" or a UNC share like "\\\\server\\share\\path".`,
    )
  }
}

// True when any segment of the raw input is `..`. This must run on the
// input, before `normalize`: normalize collapses `/media/../etc` to
// `/etc`, so a check on its output never sees the traversal.
const hasTraversalSegment = (path: string) =>
  path.split(/[\\/]/u).some((segment) => segment === "..")

// Returns the path normalized and validated. Throws PathSafetyError on
// anything that's not an absolute, traversal-free path.
export const validateReadablePath = (
  path: string,
): string => {
  if (typeof path !== "string" || path.length === 0) {
    throw new PathSafetyError("Path is required")
  }
  if (!isAbsolute(path)) {
    throw new PathSafetyError(
      `Path must be absolute: ${path}`,
    )
  }
  validateWindowsAbsolutePath({
    cwd: getCwd(),
    path,
    platform: getPlatform(),
  })
  if (hasTraversalSegment(path)) {
    throw new PathSafetyError(
      `Path traversal not allowed: ${path}`,
    )
  }
  return normalize(path)
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
  const rootWithSeparator =
    MEDIA_ROOT.endsWith(sep) || MEDIA_ROOT.endsWith("/")
      ? MEDIA_ROOT
      : `${MEDIA_ROOT}/`
  if (
    normalized !== MEDIA_ROOT &&
    !normalized.startsWith(rootWithSeparator) &&
    !normalized.startsWith(`${MEDIA_ROOT}${sep}`)
  ) {
    throw new PathSafetyError(
      `Path is outside the allowed media root (${MEDIA_ROOT}): ${path}`,
    )
  }
  return normalized
}

// The roots that file-changing routes (delete, rename, move) may touch.
// ALLOWED_FILE_ROOTS is a list of absolute paths split by the platform's
// path delimiter (`:` on Linux, `;` on Windows). When it is unset, a
// container is limited to MEDIA_ROOT, where every media mount lives, and
// a local install has no limit, because there is no root that fits every
// desktop. Returns null for "no limit".
export const getAllowedFileRoots = (): string[] | null => {
  const configuredRoots = (
    process.env.ALLOWED_FILE_ROOTS ?? ""
  )
    .split(delimiter)
    .map((root) => root.trim())
    .filter((root) => root.length > 0)

  if (configuredRoots.length > 0) {
    return configuredRoots.map(validateReadablePath)
  }
  return process.env.IS_CONTAINERIZED === "true"
    ? [MEDIA_ROOT]
    : null
}

export const isPathUnderRoot = ({
  path,
  root,
}: {
  path: string
  root: string
}) => {
  const relativePath = relative(root, path)
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  )
}

// validateReadablePath plus a check that the path is inside one of the
// allowed file roots. Every route that deletes, renames, or moves a file
// calls this, so a request cannot change files outside the media mounts.
export const validateWritablePath = (
  path: string,
): string => {
  const normalized = validateReadablePath(path)
  const allowedRoots = getAllowedFileRoots()
  if (
    allowedRoots !== null &&
    !allowedRoots.some((root) =>
      isPathUnderRoot({ path: normalized, root }),
    )
  ) {
    throw new PathSafetyError(
      `Path is outside the allowed file roots (${allowedRoots.join(", ")}): ${path}`,
    )
  }
  return normalized
}
