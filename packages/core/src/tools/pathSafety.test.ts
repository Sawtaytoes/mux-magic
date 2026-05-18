import { sep } from "node:path"

import { describe, expect, test } from "vitest"

import {
  PathSafetyError,
  validateReadablePath,
} from "./pathSafety.js"

// Branch on the path module's `sep` (resolved at import time per the host
// OS) rather than `process.platform` — the test setup pins
// `process.platform` to "linux" so the `assertNotDriveRelative` guard
// stays inert against POSIX memfs fixtures, but `path.normalize` keeps
// its host-OS behavior, so the platform-specific *input* the test feeds
// in has to match the path module's flavor.
const isWindowsPathModule = sep === "\\"

describe(validateReadablePath.name, () => {
  test("returns the normalized path for a valid absolute path", () => {
    const input = isWindowsPathModule
      ? "C:\\Users\\foo"
      : "/home/foo"
    expect(validateReadablePath(input)).toBe(input)
  })

  test("rejects empty string", () => {
    expect(() => validateReadablePath("")).toThrow(
      PathSafetyError,
    )
  })

  test("rejects relative paths", () => {
    expect(() =>
      validateReadablePath("relative/dir"),
    ).toThrow(/must be absolute/)
  })

  test("collapses traversal in well-formed inputs without throwing", () => {
    // Node's path.normalize collapses these — they pass.
    const input = isWindowsPathModule
      ? "C:\\Users\\..\\..\\..\\Windows"
      : "/home/foo/../../../etc"
    expect(validateReadablePath(input)).not.toContain("..")
  })
})
