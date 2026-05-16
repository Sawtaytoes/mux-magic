import { describe, expect, test, vi } from "vitest"

import {
  getCwd,
  getPlatform,
} from "./currentEnvironment.js"
import {
  PathSafetyError,
  validateReadablePath,
  validateWindowsAbsolutePath,
} from "./pathSafety.js"

describe("validateWindowsAbsolutePath", () => {
  test("throws PathSafetyError on win32 for a drive-relative POSIX-style path", () => {
    expect(() =>
      validateWindowsAbsolutePath({
        cwd: "D:\\Projects\\Personal\\mux-magic",
        path: "/work",
        platform: "win32",
      }),
    ).toThrow(PathSafetyError)
  })

  test("error message names both the input path and the inferred CWD drive", () => {
    try {
      validateWindowsAbsolutePath({
        cwd: "D:\\Projects\\Personal\\mux-magic",
        path: "/work",
        platform: "win32",
      })
      expect.unreachable(
        "validateWindowsAbsolutePath should have thrown for /work on win32",
      )
    } catch (caughtError) {
      const errorMessage = (caughtError as PathSafetyError)
        .message
      expect(errorMessage).toContain("/work")
      expect(errorMessage).toContain("D:")
    }
  })

  test("does not throw on win32 for a fully qualified drive path", () => {
    expect(() =>
      validateWindowsAbsolutePath({
        cwd: "D:\\projects",
        path: "C:\\work",
        platform: "win32",
      }),
    ).not.toThrow()
  })

  test("does not throw on win32 for a UNC share path", () => {
    expect(() =>
      validateWindowsAbsolutePath({
        cwd: "D:\\projects",
        path: "\\\\server\\share\\dir",
        platform: "win32",
      }),
    ).not.toThrow()
  })

  test("does not throw on linux for a POSIX-style path", () => {
    expect(() =>
      validateWindowsAbsolutePath({
        cwd: "/home/dev/mux-magic",
        path: "/work",
        platform: "linux",
      }),
    ).not.toThrow()
  })

  test("does not throw on darwin for a POSIX-style path", () => {
    expect(() =>
      validateWindowsAbsolutePath({
        cwd: "/Users/dev/mux-magic",
        path: "/work",
        platform: "darwin",
      }),
    ).not.toThrow()
  })
})

// `currentEnvironment` is mocked globally in `vitest.setup.ts` to make
// `getPlatform()` return "linux" so the rest of the server suite (which
// passes POSIX fixtures through `validateReadablePath`) keeps working on
// any host. Here we override the mock per-test to exercise the win32
// branch through the real `validateReadablePath` wrapper.
describe("validateReadablePath drive-relative integration", () => {
  test("rejects /work on win32 with a drive-relative error", () => {
    vi.mocked(getPlatform).mockReturnValueOnce("win32")
    vi.mocked(getCwd).mockReturnValueOnce(
      "D:\\Projects\\Personal\\mux-magic",
    )
    expect(() => validateReadablePath("/work")).toThrow(
      /drive-relative/,
    )
  })

  test("accepts /work on linux (no platform-specific check)", () => {
    vi.mocked(getPlatform).mockReturnValueOnce("linux")
    expect(() =>
      validateReadablePath("/work"),
    ).not.toThrow()
  })
})
