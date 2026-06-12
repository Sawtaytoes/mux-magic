import { basename, join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"
import {
  containerWithVideoFileExtensions,
  filterIsContainerWithVideoFile,
  getIsContainerWithVideoFile,
} from "./filterIsContainerWithVideoFile.js"

// We need getFilesAtDepth from the tools package. Since tests use memfs,
// import via path so the fs mock intercepts the directory read.
const { getFilesAtDepth } = await import("@mux-magic/tools")

beforeEach(() => {
  vol.reset()
})

describe("containerWithVideoFileExtensions", () => {
  test("includes the six container-with-video extensions", () => {
    expect(
      containerWithVideoFileExtensions.has(".mkv"),
    ).toBe(true)
    expect(
      containerWithVideoFileExtensions.has(".mp4"),
    ).toBe(true)
    expect(
      containerWithVideoFileExtensions.has(".m4v"),
    ).toBe(true)
    expect(
      containerWithVideoFileExtensions.has(".mov"),
    ).toBe(true)
    expect(
      containerWithVideoFileExtensions.has(".webm"),
    ).toBe(true)
    expect(
      containerWithVideoFileExtensions.has(".avi"),
    ).toBe(true)
  })

  test("contains exactly six extensions", () => {
    expect(containerWithVideoFileExtensions.size).toBe(6)
  })
})

describe("getIsContainerWithVideoFile", () => {
  test("returns true for .mkv", () => {
    expect(
      getIsContainerWithVideoFile("/music/song.mkv"),
    ).toBe(true)
  })

  test("returns true for .mp4", () => {
    expect(
      getIsContainerWithVideoFile("/music/clip.mp4"),
    ).toBe(true)
  })

  test("returns true for .m4v", () => {
    expect(
      getIsContainerWithVideoFile("/music/video.m4v"),
    ).toBe(true)
  })

  test("returns true for .mov", () => {
    expect(
      getIsContainerWithVideoFile("/music/video.mov"),
    ).toBe(true)
  })

  test("returns true for .webm", () => {
    expect(
      getIsContainerWithVideoFile("/music/video.webm"),
    ).toBe(true)
  })

  test("returns true for .avi", () => {
    expect(
      getIsContainerWithVideoFile("/music/video.avi"),
    ).toBe(true)
  })

  test("returns false for .flac", () => {
    expect(
      getIsContainerWithVideoFile("/music/song.flac"),
    ).toBe(false)
  })

  test("returns false for .wav", () => {
    expect(
      getIsContainerWithVideoFile("/music/track.wav"),
    ).toBe(false)
  })

  test("returns false for .mp3", () => {
    expect(
      getIsContainerWithVideoFile("/music/track.mp3"),
    ).toBe(false)
  })

  test("returns false for .m4a", () => {
    expect(
      getIsContainerWithVideoFile("/music/track.m4a"),
    ).toBe(false)
  })

  test("is case-insensitive for .MKV", () => {
    expect(
      getIsContainerWithVideoFile("/music/VIDEO.MKV"),
    ).toBe(true)
  })

  test("is case-insensitive for .MP4", () => {
    expect(
      getIsContainerWithVideoFile("/music/VIDEO.MP4"),
    ).toBe(true)
  })
})

describe("filterIsContainerWithVideoFile", () => {
  test("passes through only container-with-video files", async () => {
    vol.fromJSON({
      "/music/song.mkv": "mkv",
      "/music/clip.mp4": "mp4",
      "/music/track.flac": "flac",
      "/music/track.wav": "wav",
      "/music/track.mp3": "mp3",
    })

    const files = await firstValueFrom(
      getFilesAtDepth({
        depth: 0,
        sourcePath: "/music",
      }).pipe(filterIsContainerWithVideoFile(), toArray()),
    )

    const names = files.map((fileInfo) =>
      basename(fileInfo.fullPath),
    )
    expect(names).toEqual(
      expect.arrayContaining(["song.mkv", "clip.mp4"]),
    )
    expect(names).toHaveLength(2)
    expect(names).not.toContain("track.flac")
    expect(names).not.toContain("track.wav")
    expect(names).not.toContain("track.mp3")
  })

  test("returns empty stream when no container files are present", async () => {
    vol.fromJSON({
      "/music/track.wav": "wav",
      "/music/track.flac": "flac",
    })

    const files = await firstValueFrom(
      getFilesAtDepth({
        depth: 0,
        sourcePath: "/music",
      }).pipe(filterIsContainerWithVideoFile(), toArray()),
    )

    expect(files).toHaveLength(0)
  })

  test("accepts .avi, .mov, .m4v, .webm alongside .mkv and .mp4", async () => {
    vol.fromJSON({
      "/music/a.avi": "avi",
      "/music/b.mov": "mov",
      "/music/c.m4v": "m4v",
      "/music/d.webm": "webm",
      "/music/e.mkv": "mkv",
      "/music/f.mp4": "mp4",
    })

    const files = await firstValueFrom(
      getFilesAtDepth({
        depth: 0,
        sourcePath: "/music",
      }).pipe(filterIsContainerWithVideoFile(), toArray()),
    )

    expect(files).toHaveLength(6)
  })

  test("full path is preserved on the emitted FileInfo", async () => {
    vol.fromJSON({ "/music/song.mkv": "mkv" })

    const files = await firstValueFrom(
      getFilesAtDepth({
        depth: 0,
        sourcePath: "/music",
      }).pipe(filterIsContainerWithVideoFile(), toArray()),
    )

    expect(files[0]?.fullPath).toBe(
      join("/music", "song.mkv"),
    )
  })
})
