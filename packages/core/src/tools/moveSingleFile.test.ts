import * as fsPromises from "node:fs/promises"
import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { getPlatform } from "./currentEnvironment.js"
import { moveSingleFile } from "./moveSingleFile.js"

vi.mock("./currentEnvironment.js", () => ({
  getCwd: vi.fn(() => "/"),
  getPlatform: vi.fn(() => "linux"),
}))

const buildCodeError = (code: string) =>
  Object.assign(new Error(`${code}: simulated failure`), {
    code,
  })

describe(moveSingleFile.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(getPlatform).mockReturnValue("linux")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("replaces an existing destination with the source", async () => {
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })

    const mode = await moveSingleFile({
      copyOptions: {},
      destinationPath: "/work/episode.mkv",
      isOverwriteAllowed: true,
      sourcePath: "/work/new/episode.mkv",
    })

    expect(mode).toBe("renamed")
    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("new bytes")
    expect(vol.existsSync("/work/new/episode.mkv")).toBe(
      false,
    )
  })

  test("never deletes the destination before the rename", async () => {
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    const unlinkSpy = vi.spyOn(fsPromises, "unlink")

    await moveSingleFile({
      copyOptions: {},
      destinationPath: "/work/episode.mkv",
      isOverwriteAllowed: true,
      sourcePath: "/work/new/episode.mkv",
    })

    expect(unlinkSpy).not.toHaveBeenCalled()
  })

  test("keeps the existing destination when the rename fails", async () => {
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    vi.spyOn(fsPromises, "rename").mockRejectedValueOnce(
      buildCodeError("EIO"),
    )

    await expect(
      moveSingleFile({
        copyOptions: {},
        destinationPath: "/work/episode.mkv",
        isOverwriteAllowed: true,
        sourcePath: "/work/new/episode.mkv",
      }),
    ).rejects.toMatchObject({ code: "EIO" })

    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("old bytes")
    expect(
      vol.readFileSync("/work/new/episode.mkv", "utf8"),
    ).toBe("new bytes")
  })

  test("keeps the existing destination when a cross-volume copy fails", async () => {
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    vi.spyOn(fsPromises, "rename").mockRejectedValueOnce(
      buildCodeError("EXDEV"),
    )
    vi.spyOn(fsPromises, "copyFile").mockRejectedValue(
      buildCodeError("ENOSPC"),
    )
    vi.spyOn(fsPromises, "open").mockRejectedValue(
      buildCodeError("ENOSPC"),
    )

    await expect(
      moveSingleFile({
        copyOptions: {},
        destinationPath: "/work/episode.mkv",
        isOverwriteAllowed: true,
        sourcePath: "/work/new/episode.mkv",
      }),
    ).rejects.toThrow()

    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("old bytes")
    expect(
      vol.readFileSync("/work/new/episode.mkv", "utf8"),
    ).toBe("new bytes")
  })

  test("on Windows, sets the destination aside when rename refuses to replace it, then removes it", async () => {
    vi.mocked(getPlatform).mockReturnValue("win32")
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    vi.spyOn(fsPromises, "rename").mockRejectedValueOnce(
      buildCodeError("EPERM"),
    )

    const mode = await moveSingleFile({
      copyOptions: {},
      destinationPath: "/work/episode.mkv",
      isOverwriteAllowed: true,
      sourcePath: "/work/new/episode.mkv",
    })

    expect(mode).toBe("renamed")
    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("new bytes")
    expect(
      vol.existsSync("/work/episode.mkv.muxmagic-replaced"),
    ).toBe(false)
  })

  test("on Windows, restores the destination when the second rename fails too", async () => {
    vi.mocked(getPlatform).mockReturnValue("win32")
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    const realRename = fsPromises.rename
    vi.spyOn(fsPromises, "rename").mockImplementation(
      (oldPath, newPath) =>
        oldPath === "/work/new/episode.mkv"
          ? Promise.reject(buildCodeError("EPERM"))
          : realRename(oldPath, newPath),
    )

    await expect(
      moveSingleFile({
        copyOptions: {},
        destinationPath: "/work/episode.mkv",
        isOverwriteAllowed: true,
        sourcePath: "/work/new/episode.mkv",
      }),
    ).rejects.toMatchObject({ code: "EPERM" })

    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("old bytes")
    expect(
      vol.existsSync("/work/episode.mkv.muxmagic-replaced"),
    ).toBe(false)
    expect(
      vol.readFileSync("/work/new/episode.mkv", "utf8"),
    ).toBe("new bytes")
  })

  test("off Windows, an EPERM rename fails without touching the destination", async () => {
    vol.fromJSON({
      "/work/new/episode.mkv": "new bytes",
      "/work/episode.mkv": "old bytes",
    })
    vi.spyOn(fsPromises, "rename").mockRejectedValueOnce(
      buildCodeError("EPERM"),
    )

    await expect(
      moveSingleFile({
        copyOptions: {},
        destinationPath: "/work/episode.mkv",
        isOverwriteAllowed: true,
        sourcePath: "/work/new/episode.mkv",
      }),
    ).rejects.toMatchObject({ code: "EPERM" })

    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("old bytes")
  })
})
