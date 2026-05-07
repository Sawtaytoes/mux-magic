import { isAbsolute, normalize, resolve, sep } from "node:path"

// Path-safety helpers shared across the file-explorer endpoints
// (list / stream / delete). The endpoints accept arbitrary paths from
// the client, so every path that crosses an API boundary needs:
//
//   1. Absolute-path validation — reject `relative/segments`.
//   2. Normalization + traversal rejection — block `..` after normalize,
//      so a client can't list/stream/delete `C:\Users\..\Windows\System32`.
//   3. Allowed-roots gate (delete only) — even with #1 + #2 a fully-
//      qualified absolute path could still point at the OS, so deletes
//      additionally require the path to live under one of the configured
//      ALLOWED_DELETE_ROOTS.
//
// Listing and streaming are read-only and skip the allowed-roots gate so
// the user can browse anywhere on disk; deletes are destructive and gated.

export class PathSafetyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PathSafetyError"
  }
}

// Returns the path normalized and validated for read-only operations
// (list / stream). Throws PathSafetyError on anything that's not an
// absolute, traversal-free path.
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

// Reads the comma-separated ALLOWED_DELETE_ROOTS env var and returns the
// list of normalized absolute roots. Empty / missing → empty list, which
// the caller treats as "no deletes allowed anywhere" (fail-closed).
export const getAllowedDeleteRoots = (): string[] => {
  const raw = process.env.ALLOWED_DELETE_ROOTS
  if (!raw) return []
  return raw
    .split(",")
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => normalize(resolve(root)))
}

// True when `path` (already passed through validateReadablePath) lives
// under one of the configured roots. Comparison is done via path-segment
// prefix match — a root of `G:\Disc-Rips` matches `G:\Disc-Rips\foo` but
// not `G:\Disc-Rips-Backup` (the latter is a sibling, not a child).
export const isUnderAllowedDeleteRoot = (
  path: string,
  allowedRoots: string[],
): boolean => {
  const normalizedPath = normalize(path)
  return allowedRoots.some((root) => {
    if (normalizedPath === root) return true
    const rootWithSep = root.endsWith(sep) ? root : root + sep
    return normalizedPath.startsWith(rootWithSep)
  })
}

// Convenience wrapper: validate AND check delete eligibility. Throws
// PathSafetyError with a user-readable message on either failure.
export const validateDeletablePath = (
  path: string,
  allowedRoots: string[],
): string => {
  const normalized = validateReadablePath(path)
  if (allowedRoots.length === 0) {
    throw new PathSafetyError(
      "Deletes are disabled — set ALLOWED_DELETE_ROOTS to one or more comma-separated roots to enable.",
    )
  }
  if (!isUnderAllowedDeleteRoot(normalized, allowedRoots)) {
    throw new PathSafetyError(
      `Path is outside the configured ALLOWED_DELETE_ROOTS: ${path}`,
    )
  }
  return normalized
}
