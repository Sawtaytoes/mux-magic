import * as fsPromises from "node:fs/promises"
import { vol } from "memfs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { aclSafeCopyFolder } from "./aclSafeCopyFolder.js"

const TEMP_SUFFIX = ".muxmagic.tmp"

// libuv's post-copy `fchmod` failing on an `aclmode=restricted` ZFS
// dataset: the bytes land, then EPERM is thrown. `fs.cp` has no hook
// for this, which is the whole reason this helper exists.
const mockEpermAfterCompleteWrite = () =>
  vi
    .spyOn(fsPromises, "copyFile")
    .mockImplementation(
      async (sourcePath, destinationPath) => {
        vol.writeFileSync(
          destinationPath as string,
          vol.readFileSync(sourcePath as string),
        )
        const error = new Error(
          "EPERM: operation not permitted, chmod",
        ) as Error & { code: string }
        error.code = "EPERM"
        throw error
      },
    )

describe(aclSafeCopyFolder.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.restoreAllMocks()
  })

  test("copies a nested tree, creating destination folders", async () => {
    vol.fromJSON({
      "/src/Season 01/ep01.mkv": "ep1",
      "/src/Season 01/subs/ep01.srt": "subs1",
      "/src/Season 02/ep01.mkv": "ep3",
      "/src/readme.txt": "notes",
    })

    await aclSafeCopyFolder("/src", "/dst/show")

    expect(
      vol.readFileSync(
        "/dst/show/Season 01/ep01.mkv",
        "utf8",
      ),
    ).toBe("ep1")
    expect(
      vol.readFileSync(
        "/dst/show/Season 01/subs/ep01.srt",
        "utf8",
      ),
    ).toBe("subs1")
    expect(
      vol.readFileSync(
        "/dst/show/Season 02/ep01.mkv",
        "utf8",
      ),
    ).toBe("ep3")
    expect(
      vol.readFileSync("/dst/show/readme.txt", "utf8"),
    ).toBe("notes")
  })

  test("copies an empty folder rather than skipping it", async () => {
    vol.fromJSON({
      "/src/Extras": null,
      "/src/ep01.mkv": "ep1",
    })

    await aclSafeCopyFolder("/src", "/dst")

    expect(vol.existsSync("/dst/Extras")).toBe(true)
  })

  test("survives the aclmode=restricted EPERM on every file in the tree", async () => {
    vol.fromJSON({
      "/src/Season 01/ep01.mkv": "ep1",
      "/src/Season 01/ep02.mkv": "ep2",
      "/src/Season 02/ep01.mkv": "ep3",
    })

    const copyFileSpy = mockEpermAfterCompleteWrite()

    await expect(
      aclSafeCopyFolder("/src", "/dst"),
    ).resolves.toBeUndefined()

    expect(copyFileSpy).toHaveBeenCalledTimes(3)
    expect(
      vol.readFileSync("/dst/Season 01/ep01.mkv", "utf8"),
    ).toBe("ep1")
    expect(
      vol.readFileSync("/dst/Season 01/ep02.mkv", "utf8"),
    ).toBe("ep2")
    expect(
      vol.readFileSync("/dst/Season 02/ep01.mkv", "utf8"),
    ).toBe("ep3")
    expect(
      vol.existsSync(
        "/dst/Season 01/ep01.mkv".concat(TEMP_SUFFIX),
      ),
    ).toBe(false)
  })

  test("refuses to clobber an existing file by default", async () => {
    vol.fromJSON({
      "/src/ep01.mkv": "fresh",
      "/dst/ep01.mkv": "stale",
    })

    await expect(
      aclSafeCopyFolder("/src", "/dst"),
    ).rejects.toMatchObject({ code: "EEXIST" })

    expect(vol.readFileSync("/dst/ep01.mkv", "utf8")).toBe(
      "stale",
    )
  })

  test("overwrites an existing file when isOverwriteAllowed is set", async () => {
    vol.fromJSON({
      "/src/ep01.mkv": "fresh",
      "/dst/ep01.mkv": "stale",
    })

    await aclSafeCopyFolder("/src", "/dst", {
      isOverwriteAllowed: true,
    })

    expect(vol.readFileSync("/dst/ep01.mkv", "utf8")).toBe(
      "fresh",
    )
  })

  test("recreates a symlink instead of following it", async () => {
    vol.fromJSON({
      "/src/ep01.mkv": "ep1",
    })
    vol.symlinkSync("/src/ep01.mkv", "/src/latest.mkv")

    await aclSafeCopyFolder("/src", "/dst")

    expect(vol.readlinkSync("/dst/latest.mkv")).toBe(
      "/src/ep01.mkv",
    )
  })

  test("stops at the next entry once the signal aborts", async () => {
    vol.fromJSON({
      "/src/ep01.mkv": "ep1",
      "/src/ep02.mkv": "ep2",
      "/src/ep03.mkv": "ep3",
    })

    const abortController = new AbortController()
    const copyFileSpy = vi
      .spyOn(fsPromises, "copyFile")
      .mockImplementation(
        async (sourcePath, destinationPath) => {
          vol.writeFileSync(
            destinationPath as string,
            vol.readFileSync(sourcePath as string),
          )
          abortController.abort()
        },
      )

    await expect(
      aclSafeCopyFolder("/src", "/dst", {
        signal: abortController.signal,
      }),
    ).rejects.toThrow()

    expect(copyFileSpy).toHaveBeenCalledTimes(1)
  })
})
