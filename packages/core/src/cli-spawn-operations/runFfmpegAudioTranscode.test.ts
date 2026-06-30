import { describe, expect, test, vi } from "vitest"
import type { TranscodeCacheKey } from "../tools/transcodeTempStore.js"
import { buildFfmpegArgs } from "./runFfmpegAudioTranscode.js"

// The shared vitest.setup.ts auto-mocks every cli-spawn-operations module
// (they wrap CLI binaries). buildFfmpegArgs is a pure arg builder with no
// spawn, so this suite needs the REAL implementation — un-register the
// auto-mock for this module.
vi.unmock("./runFfmpegAudioTranscode.js")

// Arg-building unit tests for the browser-playback transcode encoder.
// The streaming/spawn flow is exercised manually; here we only pin the
// ffmpeg argument list so the per-request plan (audio presence + video
// re-encode need) maps to the right `-map`/`-c:*` selectors.

const cacheKey: TranscodeCacheKey = {
  absPath: "/movies/film.mkv",
  audioStream: 0,
  bitrate: "192k",
  codec: "opus",
}

describe("buildFfmpegArgs", () => {
  test("defaults to copying video and mapping audio (preserves legacy callers)", () => {
    const args = buildFfmpegArgs(cacheKey)
    expect(args).toContain("-i")
    // Video copied, not re-encoded.
    expect(args).toEqual(
      expect.arrayContaining([
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
      ]),
    )
    expect(args).not.toContain("libx264")
    // Audio mapped + re-encoded to opus.
    expect(args).toContain("0:a:0")
    expect(args).toEqual(
      expect.arrayContaining(["-c:a", "libopus"]),
    )
  })

  test("omits the audio section entirely for a video-only source", () => {
    const args = buildFfmpegArgs(cacheKey, 0, {
      hasAudio: false,
      isVideoReencodeNeeded: false,
    })
    expect(args).not.toContain("-c:a")
    expect(args).not.toContain("libopus")
    expect(args).not.toContain("0:a:0")
    // Video still mapped + copied.
    expect(args).toEqual(
      expect.arrayContaining([
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
      ]),
    )
  })

  test("re-encodes non-H.264 video to libx264 High@L4.1", () => {
    const args = buildFfmpegArgs(cacheKey, 0, {
      hasAudio: false,
      isVideoReencodeNeeded: true,
    })
    expect(args).not.toContain("copy")
    expect(args).toEqual(
      expect.arrayContaining([
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-g",
        "48",
      ]),
    )
  })

  test("re-encodes video AND maps audio when both apply", () => {
    const args = buildFfmpegArgs(cacheKey, 0, {
      hasAudio: true,
      isVideoReencodeNeeded: true,
    })
    expect(args).toContain("libx264")
    expect(args).toContain("0:a:0")
    expect(args).toEqual(
      expect.arrayContaining(["-c:a", "libopus"]),
    )
  })

  test("input-side seek emits -ss before -i", () => {
    const args = buildFfmpegArgs(cacheKey, 30)
    const ssIndex = args.indexOf("-ss")
    const iIndex = args.indexOf("-i")
    expect(ssIndex).toBeGreaterThanOrEqual(0)
    expect(ssIndex).toBeLessThan(iIndex)
    expect(args[ssIndex + 1]).toBe("30")
  })

  test("always ends with the fragmented-mp4 container section to pipe:1", () => {
    const args = buildFfmpegArgs(cacheKey, 0, {
      hasAudio: false,
      isVideoReencodeNeeded: true,
    })
    expect(args.slice(-5)).toEqual([
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    ])
  })

  test("uses aac when the cache key codec is aac", () => {
    const args = buildFfmpegArgs(
      { ...cacheKey, codec: "aac" },
      0,
      { hasAudio: true, isVideoReencodeNeeded: false },
    )
    expect(args).toEqual(
      expect.arrayContaining(["-c:a", "aac"]),
    )
    expect(args).not.toContain("libopus")
  })
})
