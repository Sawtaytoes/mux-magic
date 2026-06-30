import { describe, expect, test } from "vitest"
import {
  isAudioFormatBrowserSafe,
  isContainerBrowserSupported,
  isTranscodeNeeded,
  resolveTranscodeMimeType,
} from "./fileVideoPlayerRouting"

describe("isContainerBrowserSupported", () => {
  test.each([
    ".mp4",
    ".m4v",
    ".webm",
    ".mov",
    ".MP4", // case-insensitive
  ])("treats native container %s as supported", (ext) => {
    expect(
      isContainerBrowserSupported(`/movies/film${ext}`),
    ).toBe(true)
  })

  test.each([
    ".mkv",
    ".avi",
    ".ts",
    ".m2ts",
    ".wmv",
    ".flv",
    ".mpg",
    ".mpeg",
    ".MKV", // case-insensitive
  ])("treats non-demuxable container %s as unsupported", (ext) => {
    expect(
      isContainerBrowserSupported(`/rips/disc${ext}`),
    ).toBe(false)
  })

  test("an extensionless path is treated as supported", () => {
    expect(
      isContainerBrowserSupported("/movies/film"),
    ).toBe(true)
  })
})

describe("isAudioFormatBrowserSafe", () => {
  test.each([
    null,
    "",
    "aac",
    "AAC",
    "flac",
    "opus",
  ])("treats %s as browser-safe", (format) => {
    expect(isAudioFormatBrowserSafe(format)).toBe(true)
  })

  test.each([
    "DTS",
    "dts",
    "TrueHD",
    "AC-3",
    "E-AC-3",
    "EAC3",
    "PCM",
    "MLP FBA",
  ])("treats %s as needing transcode", (format) => {
    expect(isAudioFormatBrowserSafe(format)).toBe(false)
  })
})

describe("isTranscodeNeeded", () => {
  test("native container + browser-safe audio → direct stream", () => {
    expect(
      isTranscodeNeeded({
        audioFormat: "AAC",
        path: "/movies/film.mp4",
      }),
    ).toBe(false)
  })

  test("native container + unsupported audio → transcode", () => {
    expect(
      isTranscodeNeeded({
        audioFormat: "DTS",
        path: "/movies/film.mp4",
      }),
    ).toBe(true)
  })

  // The goal-1 regression: an MKV with browser-safe audio still can't be
  // demuxed natively, so it MUST transcode even though the audio is fine.
  test("non-native container + browser-safe audio → transcode", () => {
    expect(
      isTranscodeNeeded({
        audioFormat: "AAC",
        path: "/rips/disc.mkv",
      }),
    ).toBe(true)
  })

  test("non-native container + unknown audio (null) → transcode", () => {
    expect(
      isTranscodeNeeded({
        audioFormat: null,
        path: "/rips/disc.mkv",
      }),
    ).toBe(true)
  })

  test("native container + unknown audio (null) → direct stream", () => {
    expect(
      isTranscodeNeeded({
        audioFormat: null,
        path: "/movies/film.mp4",
      }),
    ).toBe(false)
  })
})

describe("resolveTranscodeMimeType", () => {
  test("passes through a full RFC 6381 codec string + opus when audio present", () => {
    expect(
      resolveTranscodeMimeType("avc1.640029", true),
    ).toBe('video/mp4; codecs="avc1.640029,opus"')
  })

  test("omits opus for a video-only source (no audio)", () => {
    expect(
      resolveTranscodeMimeType("avc1.640029", false),
    ).toBe('video/mp4; codecs="avc1.640029"')
  })

  test.each([
    ["avc1", "avc1.640029"],
    ["hvc1", "hvc1.1.6.L150.B0"],
    ["av01", "av01.0.08M.08"],
  ])("expands legacy base codec %s to its fallback (with audio)", (tag, expanded) => {
    expect(resolveTranscodeMimeType(tag, true)).toBe(
      `video/mp4; codecs="${expanded},opus"`,
    )
  })

  test.each([
    ["avc1", "avc1.640029"],
    ["hvc1", "hvc1.1.6.L150.B0"],
    ["av01", "av01.0.08M.08"],
  ])("expands legacy base codec %s without opus when no audio", (tag, expanded) => {
    expect(resolveTranscodeMimeType(tag, false)).toBe(
      `video/mp4; codecs="${expanded}"`,
    )
  })

  test("returns null for a null tag (→ direct-src fallback)", () => {
    expect(resolveTranscodeMimeType(null, true)).toBeNull()
  })

  test("returns null for an unknown base codec tag", () => {
    expect(
      resolveTranscodeMimeType("vp09", true),
    ).toBeNull()
  })
})
