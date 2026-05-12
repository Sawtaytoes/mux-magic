import { vol } from "memfs"
import { describe, expect, test, vi } from "vitest"

import {
  aclSafeCopyFile,
  type CopyProgressEvent,
} from "./aclSafeCopyFile.js"

describe(aclSafeCopyFile.name, () => {
  test("copies file contents to a new destination", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "anime episode bytes",
      "/anime": null,
    })

    await expect(
      aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
      ),
    ).resolves.toBeUndefined()

    expect(
      vol.readFileSync("/anime/target.mkv", "utf8"),
    ).toBe("anime episode bytes")
  })

  test("overwrites an existing destination", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "fresh bytes",
      "/anime/target.mkv": "stale bytes",
    })

    await expect(
      aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
      ),
    ).resolves.toBeUndefined()

    expect(
      vol.readFileSync("/anime/target.mkv", "utf8"),
    ).toBe("fresh bytes")
  })

  test("rejects when the source is missing", async () => {
    await expect(
      aclSafeCopyFile(
        "/cache/missing.mkv",
        "/anime/target.mkv",
      ),
    ).rejects.toThrow("no such file or directory")
  })

  test("leaves the source untouched", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "original bytes",
      "/anime": null,
    })

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
    )

    expect(
      vol.readFileSync("/cache/source.mkv", "utf8"),
    ).toBe("original bytes")
  })

  test("reports progress when onProgress is supplied", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "twelve bytes",
      "/anime": null,
    })

    const progressEvents: CopyProgressEvent[] = []

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
      {
        onProgress: (event) => {
          progressEvents.push(event)
        },
      },
    )

    expect(progressEvents.length).toBeGreaterThan(0)

    const finalEvent = progressEvents.at(-1)
    if (finalEvent == null)
      throw new Error("no progress events")

    expect(finalEvent.source).toBe("/cache/source.mkv")
    expect(finalEvent.destination).toBe("/anime/target.mkv")
    expect(finalEvent.totalBytes).toBe(12)
    expect(finalEvent.bytesWritten).toBe(12)
  })

  test("does not call onProgress when options are omitted", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "anything",
      "/anime": null,
    })

    const onProgress = vi.fn()

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
    )

    expect(onProgress).not.toHaveBeenCalled()
  })

  test("aborts via signal and unlinks the partial destination", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "x".repeat(1024 * 64),
      "/anime": null,
    })

    const abortController = new AbortController()
    abortController.abort()

    await expect(
      aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
        { signal: abortController.signal },
      ),
    ).rejects.toBeDefined()

    expect(vol.existsSync("/anime/target.mkv")).toBe(false)
  })
})
