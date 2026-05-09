import { vol } from "memfs"
import { describe, expect, test, vi } from "vitest"

import { aclSafeCopyFile, type CopyProgressEvent } from "./aclSafeCopyFile.js"

describe(aclSafeCopyFile.name, () => {
  test("copies file contents to a new destination", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "anime episode bytes",
      "G:\\Anime": null,
    })

    await expect(
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .resolves
    .toBeUndefined()

    expect(
      vol
      .readFileSync(
        "G:\\Anime\\target.mkv",
        "utf8",
      )
    )
    .toBe(
      "anime episode bytes"
    )
  })

  test("overwrites an existing destination", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "fresh bytes",
      "G:\\Anime\\target.mkv": "stale bytes",
    })

    await expect(
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .resolves
    .toBeUndefined()

    expect(
      vol
      .readFileSync(
        "G:\\Anime\\target.mkv",
        "utf8",
      )
    )
    .toBe(
      "fresh bytes"
    )
  })

  test("rejects when the source is missing", async () => {
    await expect(
      aclSafeCopyFile(
        "G:\\cache\\missing.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .rejects
    .toThrow(
      "no such file or directory"
    )
  })

  test("leaves the source untouched", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "original bytes",
      "G:\\Anime": null,
    })

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\cache\\source.mkv",
        "utf8",
      )
    )
    .toBe(
      "original bytes"
    )
  })

  test("reports progress when onProgress is supplied", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "twelve bytes",
      "G:\\Anime": null,
    })

    const progressEvents: CopyProgressEvent[] = []

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
        {
          onProgress: (event) => {
            progressEvents.push(event)
          },
        },
      )
    )

    expect(
      progressEvents
      .length
    )
    .toBeGreaterThan(0)

    const finalEvent = (
      progressEvents
      .at(-1)!
    )

    expect(finalEvent.source).toBe("G:\\cache\\source.mkv")
    expect(finalEvent.destination).toBe("G:\\Anime\\target.mkv")
    expect(finalEvent.totalBytes).toBe(12)
    expect(finalEvent.bytesWritten).toBe(12)
  })

  test("does not call onProgress when options are omitted", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "anything",
      "G:\\Anime": null,
    })

    const onProgress = vi.fn()

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )

    expect(onProgress).not.toHaveBeenCalled()
  })

  test("aborts via signal and unlinks the partial destination", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "x".repeat(1024 * 64),
      "G:\\Anime": null,
    })

    const abortController = new AbortController()
    abortController.abort()

    await expect(
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
        { signal: abortController.signal },
      )
    )
    .rejects
    .toBeDefined()

    expect(vol.existsSync("G:\\Anime\\target.mkv")).toBe(false)
  })
})
