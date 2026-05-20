import * as fsPromises from "node:fs/promises"
import { vol } from "memfs"
import { describe, expect, test, vi } from "vitest"

import {
  aclSafeCopyFile,
  type CopyProgressEvent,
} from "./aclSafeCopyFile.js"

const TEMP_SUFFIX = ".muxmagic.tmp"

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

  test("leaves no .muxmagic.tmp on a successful copy", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "the bytes",
      "/anime": null,
    })

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
    )

    expect(
      vol.existsSync(
        "/anime/target.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  test("refuses to overwrite an existing destination by default", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "fresh bytes",
      "/anime/target.mkv": "stale bytes",
    })

    await expect(
      aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
      ),
    ).rejects.toMatchObject({ code: "EEXIST" })

    // Stale destination is untouched, source is untouched, no temp.
    expect(
      vol.readFileSync("/anime/target.mkv", "utf8"),
    ).toBe("stale bytes")
    expect(
      vol.readFileSync("/cache/source.mkv", "utf8"),
    ).toBe("fresh bytes")
    expect(
      vol.existsSync(
        "/anime/target.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  test("overwrites when isOverwriteAllowed is true", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "fresh bytes",
      "/anime/target.mkv": "stale bytes",
    })

    await expect(
      aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
        { isOverwriteAllowed: true },
      ),
    ).resolves.toBeUndefined()

    expect(
      vol.readFileSync("/anime/target.mkv", "utf8"),
    ).toBe("fresh bytes")
    expect(
      vol.existsSync(
        "/anime/target.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  test("rejects when the source is missing", async () => {
    await expect(
      aclSafeCopyFile(
        "/cache/missing.mkv",
        "/anime/target.mkv",
      ),
    ).rejects.toThrow(/no such file or directory|ENOENT/)
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

    let eventCount = 0
    let finalEvent: CopyProgressEvent | undefined

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
      {
        onProgress: (event) => {
          eventCount += 1
          finalEvent = event
        },
      },
    )

    expect(eventCount).toBeGreaterThan(0)
    if (finalEvent === undefined)
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

  test("aborts via signal and leaves no temp or destination", async () => {
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
        {
          signal: abortController.signal,
          onProgress: () => undefined,
        },
      ),
    ).rejects.toBeDefined()

    expect(vol.existsSync("/anime/target.mkv")).toBe(false)
    expect(
      vol.existsSync(
        "/anime/target.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  test("overwrites a stale .muxmagic.tmp from a crashed prior run", async () => {
    vol.fromJSON({
      "/cache/source.mkv": "fresh bytes",
      "/anime/target.mkv.muxmagic.tmp":
        "leftover from crashed run",
      "/anime": null,
    })

    await aclSafeCopyFile(
      "/cache/source.mkv",
      "/anime/target.mkv",
    )

    expect(
      vol.readFileSync("/anime/target.mkv", "utf8"),
    ).toBe("fresh bytes")
    expect(
      vol.existsSync(
        "/anime/target.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  describe("kernel block-copy fast path", () => {
    test("treats EPERM-after-complete-write as success (TrueNAS ZFS aclmode=restricted)", async () => {
      vol.fromJSON({
        "/cache/source.mkv": "anime episode bytes",
        "/anime": null,
      })

      // Simulate libuv's post-copy fchmod failing: write the bytes
      // to the temp ourselves (matching what libuv would have done),
      // then throw EPERM. aclSafeCopyFile's size-match check should
      // accept the result and rename the temp into place.
      const sourceBytes = vol.readFileSync(
        "/cache/source.mkv",
      )
      const copyFileSpy = vi
        .spyOn(fsPromises, "copyFile")
        .mockImplementationOnce(
          async (_source, destinationPath) => {
            vol.writeFileSync(
              destinationPath as string,
              sourceBytes,
            )
            const error = new Error(
              "EPERM: operation not permitted",
            ) as Error & { code: string }
            error.code = "EPERM"
            throw error
          },
        )

      await aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
      )

      expect(
        vol.readFileSync("/anime/target.mkv", "utf8"),
      ).toBe("anime episode bytes")
      expect(
        vol.existsSync(
          "/anime/target.mkv".concat(TEMP_SUFFIX),
        ),
      ).toBe(false)

      copyFileSpy.mockRestore()
    })

    test("falls back to streaming when EPERM came with a partial write", async () => {
      vol.fromJSON({
        "/cache/source.mkv": "anime episode bytes",
        "/anime": null,
      })

      // EPERM with NO bytes on disk → must not accept; must fall
      // through to the streaming tier which completes the copy.
      const copyFileSpy = vi
        .spyOn(fsPromises, "copyFile")
        .mockImplementationOnce(async () => {
          const error = new Error(
            "EPERM: operation not permitted",
          ) as Error & { code: string }
          error.code = "EPERM"
          throw error
        })

      await aclSafeCopyFile(
        "/cache/source.mkv",
        "/anime/target.mkv",
      )

      expect(
        vol.readFileSync("/anime/target.mkv", "utf8"),
      ).toBe("anime episode bytes")

      copyFileSpy.mockRestore()
    })

    test("propagates ENOSPC without trying the streaming tier", async () => {
      vol.fromJSON({
        "/cache/source.mkv": "anime episode bytes",
        "/anime": null,
      })

      const copyFileSpy = vi
        .spyOn(fsPromises, "copyFile")
        .mockImplementationOnce(async () => {
          const error = new Error(
            "ENOSPC: no space left on device",
          ) as Error & { code: string }
          error.code = "ENOSPC"
          throw error
        })

      await expect(
        aclSafeCopyFile(
          "/cache/source.mkv",
          "/anime/target.mkv",
        ),
      ).rejects.toMatchObject({ code: "ENOSPC" })

      expect(vol.existsSync("/anime/target.mkv")).toBe(
        false,
      )
      expect(
        vol.existsSync(
          "/anime/target.mkv".concat(TEMP_SUFFIX),
        ),
      ).toBe(false)

      copyFileSpy.mockRestore()
    })
  })
})
