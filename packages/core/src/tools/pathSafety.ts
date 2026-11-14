import { lstatSync, readlinkSync } from "node:fs"
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  normalize,
  parse,
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

// The same limit Linux uses before it reports ELOOP.
const maximumLinkHops = 40

const getIsSymbolicLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

// Resolves the path the way the operating system walks it: one segment
// at a time, following each symbolic link as it is reached, and taking
// `..` as the parent of the folder reached so far. Lexical
// normalization (`resolve`, `join`) would take `/media/hop/..` as
// `/media` even when `hop` links to `/outside/child`, where the system
// lands in `/outside`. A link whose target does not exist yet is still
// followed, so a write through it is checked where it would land.
// `isLastLinkFollowed: false` leaves a link in the last segment as it
// is, for operations that change the link itself.
// Only the host's own separator splits a path: on Linux a backslash is
// an ordinary character in a file name, so `/media/a\b` is one entry.
const separatorPattern = sep === "\\" ? /[\\/]+/u : /\/+/u

type PhysicalWalk = {
  hopCount: number
  path: string
}

// `hopCount` is carried through the whole walk, so every link followed
// anywhere in the path counts against one limit, as on Linux. A budget
// per segment would let a small set of links that expand into each
// other cost exponential work.
const walkPhysicalPath = ({
  hopCount,
  isLastLinkFollowed,
  path,
}: {
  hopCount: number
  isLastLinkFollowed: boolean
  path: string
}): PhysicalWalk => {
  const { root } = parse(path)
  const rawSegments = path
    .slice(root.length)
    .split(separatorPattern)
  const lastRawSegment = rawSegments.at(-1)
  // A trailing separator or `.` makes the system resolve the last
  // entry as a folder, which follows a link there.
  const isFinalLinkFollowed =
    isLastLinkFollowed ||
    lastRawSegment === "" ||
    lastRawSegment === "."
  const segments = rawSegments.filter(
    (segment) => segment.length > 0 && segment !== ".",
  )
  return segments.reduce<PhysicalWalk>(
    (walk, segment, index) =>
      segment === ".."
        ? {
            hopCount: walk.hopCount,
            path: dirname(walk.path),
          }
        : index === segments.length - 1 &&
            !isFinalLinkFollowed
          ? {
              hopCount: walk.hopCount,
              path: join(walk.path, segment),
            }
          : followSymbolicLink({
              hopCount: walk.hopCount,
              path: join(walk.path, segment),
            }),
    { hopCount, path: root },
  )
}

const followSymbolicLink = ({
  hopCount,
  path,
}: PhysicalWalk): PhysicalWalk => {
  if (!getIsSymbolicLink(path)) {
    return { hopCount, path }
  }
  if (hopCount >= maximumLinkHops) {
    throw new PathSafetyError(
      `Too many symbolic links: ${path}`,
    )
  }
  const linkTarget = readlinkSync(path)
  return walkPhysicalPath({
    hopCount: hopCount + 1,
    isLastLinkFollowed: true,
    // Concatenated, not joined: join would collapse a `..` in the
    // target before the walk could see it.
    path: isAbsolute(linkTarget)
      ? linkTarget
      : `${dirname(path)}${sep}${linkTarget}`,
  })
}

const resolvePhysicalPath = ({
  isLastLinkFollowed,
  path,
}: {
  isLastLinkFollowed: boolean
  path: string
}): string =>
  walkPhysicalPath({
    hopCount: 0,
    isLastLinkFollowed,
    path,
  }).path

// Resolves every symbolic link in the path, including one whose target
// does not exist yet, and keeps the parts that do not exist (a rename
// target, say). A link inside a root that points outside it therefore
// resolves outside, and the containment check sees where the change
// would really land.
export const resolveExistingPath = (path: string): string =>
  resolvePhysicalPath({
    isLastLinkFollowed: true,
    path,
  })

const isInsideAllowedRoots = ({
  allowedRoots,
  path,
}: {
  allowedRoots: string[]
  path: string
}) =>
  allowedRoots.some((root) =>
    isPathUnderRoot({
      path,
      root: resolveExistingPath(root),
    }),
  )

// validateReadablePath plus a check that the path is inside one of the
// allowed file roots, after symbolic links are resolved. The file
// explorer and music routes call it on every path they change, and
// deleteFiles calls it on every path it deletes.
export const validateWritablePath = (
  path: string,
): string => {
  const normalized = validateReadablePath(path)
  const allowedRoots = getAllowedFileRoots()
  if (
    allowedRoots !== null &&
    !isInsideAllowedRoots({
      allowedRoots,
      path: resolveExistingPath(normalized),
    })
  ) {
    throw new PathSafetyError(
      `Path is outside the allowed file roots (${allowedRoots.join(", ")}): ${path}`,
    )
  }
  return normalized
}

// The containment check that core's write primitives
// (guardedFileWrites.ts) run on every path a command changes, including
// paths the command builds or finds while it runs. It checks only the
// allowed file roots, not the API's absolute-path and traversal rules:
// a CLI user may pass a relative path, so a relative path is resolved
// against the working directory first. Links and `..` are resolved the
// way the operating system walks them (resolvePhysicalPath). It does nothing when there is no
// limit (a source install with no ALLOWED_FILE_ROOTS).
//
// `isLinkFollowed` says whether the operation acts on what a symbolic
// link points to (writing, copying onto, or setting times on a file) or
// on the directory entry itself (renaming, deleting, or creating it). A
// write through a link that leads outside a root is refused. Renaming
// or deleting the link itself is allowed when the link sits inside a
// root, because only the link changes.
export const assertWritePathInsideAllowedRoots = ({
  isLinkFollowed,
  path,
}: {
  isLinkFollowed: boolean
  path: string
}): void => {
  const allowedRoots = getAllowedFileRoots()
  if (allowedRoots === null) {
    return
  }
  // Concatenated, not resolved: `resolve` would collapse a `..` before
  // the walk could see where it really leads.
  // A Windows drive-relative path (`C:file`, `C:..\file`) resolves
  // against that drive's own working directory, which this process
  // cannot see, so it is refused rather than guessed at.
  if (!isAbsolute(path) && parse(path).root !== "") {
    throw new PathSafetyError(
      `Drive-relative paths are not allowed when file roots are set. Use a fully qualified path: ${path}`,
    )
  }
  const resolvedPath = resolvePhysicalPath({
    isLastLinkFollowed: isLinkFollowed,
    path: isAbsolute(path)
      ? path
      : `${getCwd()}${sep}${path}`,
  })
  if (
    !isInsideAllowedRoots({
      allowedRoots,
      path: resolvedPath,
    })
  ) {
    throw new PathSafetyError(
      `Path is outside the allowed file roots (${allowedRoots.join(", ")}): ${path}`,
    )
  }
}

// Command parameters that name a file or folder a command reads from or
// writes to. `rootPath` is left out on purpose: it is the path a media
// player sees, written into a JSON file, and it need not exist here.
const COMMAND_PATH_PARAMETER_NAMES = new Set([
  "comparisonPath",
  "copiedDestinationPaths",
  "destinationFilesPath",
  "destinationPath",
  "filePath",
  "holdingFolderPath",
  "manifestPath",
  "outputPath",
  "parentPath",
  "pathsToDelete",
  "sourceFolderPath",
  "sourcePath",
  "sourceRootPath",
  "subtitlesPath",
])

const toPathValues = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).filter(
    (item): item is string =>
      typeof item === "string" && item.length > 0,
  )

const describePathProblem = ({
  name,
  path,
}: {
  name: string
  path: string
}) => {
  try {
    validateWritablePath(path)
    return null
  } catch (error) {
    return `${name}: ${error instanceof Error ? error.message : String(error)}`
  }
}

// Returns one message per command path parameter that falls outside the
// allowed file roots. Empty when there is no limit (a source install
// with no ALLOWED_FILE_ROOTS) or when every path is inside. Commands and
// sequence steps call this before they run, so a bad parameter fails
// before any work starts. A path a command builds or discovers later is
// checked by core's write primitives instead
// (assertWritePathInsideAllowedRoots).
export const findCommandPathsOutsideAllowedRoots = (
  params: Record<string, unknown>,
): string[] =>
  getAllowedFileRoots() === null
    ? []
    : Object.entries(params)
        .filter(([name]) =>
          COMMAND_PATH_PARAMETER_NAMES.has(name),
        )
        .flatMap(([name, value]) =>
          toPathValues(value).map((path) =>
            describePathProblem({ name, path }),
          ),
        )
        .filter((problem) => problem !== null)
