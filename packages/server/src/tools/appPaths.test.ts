import { describe, expect, test, vi } from "vitest"

describe("mediaInfoPath", () => {
  test("respects MEDIAINFO_PATH environment variable when set", async () => {
    vi.resetModules()
    process.env.MEDIAINFO_PATH =
      "C:\\CustomPath\\MediaInfo.exe"
    const { mediaInfoPath } = await import("./appPaths.js")
    expect(mediaInfoPath).toBe(
      "C:\\CustomPath\\MediaInfo.exe",
    )
    delete process.env.MEDIAINFO_PATH
  })

  test("uses MEDIAINFO_PATH when set to custom value", async () => {
    vi.resetModules()
    const customPath = "/usr/local/bin/mediainfo"
    process.env.MEDIAINFO_PATH = customPath
    const { mediaInfoPath } = await import("./appPaths.js")
    expect(mediaInfoPath).toBe(customPath)
    delete process.env.MEDIAINFO_PATH
  })

  test("falls back to platform default when MEDIAINFO_PATH is not set", async () => {
    vi.resetModules()
    delete process.env.MEDIAINFO_PATH
    const { mediaInfoPath } = await import("./appPaths.js")
    const isWindows = process.platform === "win32"
    const expected = isWindows
      ? "assets/mediainfo/MediaInfo.exe"
      : "mediainfo"
    expect(mediaInfoPath).toBe(expected)
  })
})
