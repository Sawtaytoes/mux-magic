import { describe, expect, test } from "vitest"

import {
  PathSafetyError,
  validateReadablePath,
} from "./pathSafety.js"

describe(validateReadablePath.name, () => {
  test("returns the normalized path for a valid absolute path", () => {
    const input =
      process.platform === "win32"
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
    const input =
      process.platform === "win32"
        ? "C:\\Users\\..\\..\\..\\Windows"
        : "/home/foo/../../../etc"
    expect(validateReadablePath(input)).not.toContain("..")
  })
})
