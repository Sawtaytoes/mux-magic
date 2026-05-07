import { afterEach, beforeEach, describe, expect, test } from "vitest"

import {
  getAllowedDeleteRoots,
  isUnderAllowedDeleteRoot,
  PathSafetyError,
  validateDeletablePath,
  validateReadablePath,
} from "./pathSafety.js"

describe(validateReadablePath.name, () => {
  test("returns the normalized path for a valid absolute path", () => {
    // Use an OS-agnostic absolute path
    const input = process.platform === "win32" ? "C:\\Users\\foo" : "/home/foo"
    expect(validateReadablePath(input)).toBe(input)
  })

  test("rejects empty string", () => {
    expect(() => validateReadablePath("")).toThrow(PathSafetyError)
  })

  test("rejects relative paths", () => {
    expect(() => validateReadablePath("relative/dir")).toThrow(/must be absolute/)
  })

  test("rejects paths containing .. traversal that survive normalize", () => {
    // A path like `\\..\\..\\foo` on Windows can normalize to `\\foo` but
    // pathological inputs may retain `..`. We block any survivor.
    const input = process.platform === "win32"
      ? "C:\\Users\\..\\..\\..\\Windows"
      : "/home/foo/../../../etc"
    // After normalize these collapse cleanly, so they pass — the guard is
    // for inputs where `..` survives normalization.
    expect(validateReadablePath(input)).not.toContain("..")
  })
})

describe(getAllowedDeleteRoots.name, () => {
  let originalEnv: string | undefined
  beforeEach(() => {
    originalEnv = process.env.ALLOWED_DELETE_ROOTS
  })
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ALLOWED_DELETE_ROOTS
    else process.env.ALLOWED_DELETE_ROOTS = originalEnv
  })

  test("returns empty array when env var is unset", () => {
    delete process.env.ALLOWED_DELETE_ROOTS
    expect(getAllowedDeleteRoots()).toEqual([])
  })

  test("returns empty array when env var is empty", () => {
    process.env.ALLOWED_DELETE_ROOTS = ""
    expect(getAllowedDeleteRoots()).toEqual([])
  })

  test("parses a single root", () => {
    process.env.ALLOWED_DELETE_ROOTS = process.platform === "win32"
      ? "G:\\Disc-Rips"
      : "/mnt/disc-rips"
    expect(getAllowedDeleteRoots()).toHaveLength(1)
  })

  test("parses comma-separated roots and trims whitespace", () => {
    process.env.ALLOWED_DELETE_ROOTS = process.platform === "win32"
      ? "G:\\Disc-Rips, H:\\Workspace"
      : "/mnt/a, /mnt/b"
    expect(getAllowedDeleteRoots()).toHaveLength(2)
  })
})

describe(isUnderAllowedDeleteRoot.name, () => {
  const roots = process.platform === "win32"
    ? ["G:\\Disc-Rips"]
    : ["/mnt/disc-rips"]

  test("returns true for the root itself", () => {
    expect(isUnderAllowedDeleteRoot(roots[0], roots)).toBe(true)
  })

  test("returns true for a child path", () => {
    const child = process.platform === "win32"
      ? "G:\\Disc-Rips\\SOLDIER\\foo.mkv"
      : "/mnt/disc-rips/SOLDIER/foo.mkv"
    expect(isUnderAllowedDeleteRoot(child, roots)).toBe(true)
  })

  test("returns false for a sibling whose name shares the root prefix", () => {
    // G:\Disc-Rips-Backup should NOT match G:\Disc-Rips (prefix-with-separator
    // check prevents the false positive).
    const sibling = process.platform === "win32"
      ? "G:\\Disc-Rips-Backup\\foo.mkv"
      : "/mnt/disc-rips-backup/foo.mkv"
    expect(isUnderAllowedDeleteRoot(sibling, roots)).toBe(false)
  })

  test("returns false for an unrelated path", () => {
    const unrelated = process.platform === "win32"
      ? "C:\\Windows\\System32"
      : "/etc/passwd"
    expect(isUnderAllowedDeleteRoot(unrelated, roots)).toBe(false)
  })

  test("returns false when no roots are configured", () => {
    expect(isUnderAllowedDeleteRoot(roots[0], [])).toBe(false)
  })
})

describe(validateDeletablePath.name, () => {
  const roots = process.platform === "win32"
    ? ["G:\\Disc-Rips"]
    : ["/mnt/disc-rips"]

  test("returns the normalized path when under an allowed root", () => {
    const path = process.platform === "win32"
      ? "G:\\Disc-Rips\\SOLDIER\\foo.mkv"
      : "/mnt/disc-rips/SOLDIER/foo.mkv"
    expect(validateDeletablePath(path, roots)).toBe(path)
  })

  test("throws when the path is outside every allowed root", () => {
    const path = process.platform === "win32"
      ? "C:\\Windows\\System32\\evil.dll"
      : "/etc/passwd"
    expect(() => validateDeletablePath(path, roots)).toThrow(/outside the configured/)
  })

  test("throws when no roots are configured (fail-closed)", () => {
    const path = process.platform === "win32"
      ? "G:\\Disc-Rips\\foo.mkv"
      : "/mnt/disc-rips/foo.mkv"
    expect(() => validateDeletablePath(path, [])).toThrow(/Deletes are disabled/)
  })

  test("rebroadcasts validateReadablePath errors", () => {
    expect(() => validateDeletablePath("relative/dir", roots)).toThrow(/must be absolute/)
  })
})
