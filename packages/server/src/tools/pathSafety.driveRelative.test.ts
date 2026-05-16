import { afterEach, describe, expect, test } from "vitest"

import {
  assertNotDriveRelative,
  PathSafetyError,
  validateReadablePath,
} from "./pathSafety.js"

// `process.platform` is a value property, not a getter, so stubbing it
// requires `Object.defineProperty`. Capturing the original descriptor at
// module load lets each integration test restore it deterministically.
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  process,
  "platform",
) as PropertyDescriptor

const stubPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform,
  })
}

describe("assertNotDriveRelative", () => {
  test("throws PathSafetyError on win32 for a drive-relative POSIX-style path", () => {
    expect(() =>
      assertNotDriveRelative({
        cwd: "D:\\Projects\\Personal\\mux-magic",
        path: "/work",
        platform: "win32",
      }),
    ).toThrow(PathSafetyError)
  })

  test("error message names both the input path and the inferred CWD drive", () => {
    try {
      assertNotDriveRelative({
        cwd: "D:\\Projects\\Personal\\mux-magic",
        path: "/work",
        platform: "win32",
      })
      expect.unreachable(
        "assertNotDriveRelative should have thrown for /work on win32",
      )
    } catch (caughtError) {
      const errorMessage = (caughtError as PathSafetyError).message
      expect(errorMessage).toContain("/work")
      expect(errorMessage).toContain("D:")
    }
  })

  test("does not throw on win32 for a fully qualified drive path", () => {
    expect(() =>
      assertNotDriveRelative({
        cwd: "D:\\projects",
        path: "C:\\work",
        platform: "win32",
      }),
    ).not.toThrow()
  })

  test("does not throw on win32 for a UNC share path", () => {
    expect(() =>
      assertNotDriveRelative({
        cwd: "D:\\projects",
        path: "\\\\server\\share\\dir",
        platform: "win32",
      }),
    ).not.toThrow()
  })

  test("does not throw on linux for a POSIX-style path", () => {
    expect(() =>
      assertNotDriveRelative({
        cwd: "/home/dev/mux-magic",
        path: "/work",
        platform: "linux",
      }),
    ).not.toThrow()
  })

  test("does not throw on darwin for a POSIX-style path", () => {
    expect(() =>
      assertNotDriveRelative({
        cwd: "/Users/dev/mux-magic",
        path: "/work",
        platform: "darwin",
      }),
    ).not.toThrow()
  })
})

describe("validateReadablePath drive-relative integration", () => {
  afterEach(() => {
    Object.defineProperty(
      process,
      "platform",
      originalPlatformDescriptor,
    )
  })

  test("rejects /work on win32 with a drive-relative error", () => {
    stubPlatform("win32")
    expect(() => validateReadablePath("/work")).toThrow(
      /drive-relative/,
    )
  })

  test("accepts /work on linux (no platform-specific check)", () => {
    stubPlatform("linux")
    expect(() => validateReadablePath("/work")).not.toThrow()
  })
})
