import * as fsPromises from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { EmptyError, firstValueFrom } from "rxjs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { captureLogMessage } from "./captureLogMessage.js"
import {
  createRenameFileOrFolderObservable,
  getLastItemInFilePath,
  renameFileOrFolder,
} from "./createRenameFileOrFolder.js"

describe(getLastItemInFilePath.name, () => {
  test("gets filename when no path", async () => {
    expect(
      getLastItemInFilePath("Star Wars (1977).mkv"),
    ).toBe("Star Wars (1977)")
  })

  test("gets filename from shallow path", async () => {
    expect(
      getLastItemInFilePath(
        "~/movies/Star Wars (1977) {edition-4K77}.mkv",
      ),
    ).toBe("Star Wars (1977) {edition-4K77}")
  })

  test("gets filename from deep path", async () => {
    expect(
      getLastItemInFilePath(
        "~/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
      ),
    ).toBe("Star Wars (1977) {edition-4K77}")
  })

  test("gets folder name from path if no file", async () => {
    expect(
      getLastItemInFilePath("~/movies/Star Wars (1977)"),
    ).toBe("Star Wars (1977)")
  })
})

describe(renameFileOrFolder.name, () => {
  test("errors when the current file is missing", async () => {
    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath:
            "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath:
            "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        }),
      ),
    ).rejects.toThrow("no such file or directory")
  })

  test("errors when the renamed file already exists", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv":
        "",
    })

    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath:
            "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath:
            "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        }),
      ),
    ).rejects.toThrow("already exists")
  })

  test("renames a file", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
    })

    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath:
            "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath:
            "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        }),
      ),
    ).resolves.toBeUndefined()
  })
})

describe(`${renameFileOrFolder.name} claims names atomically`, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("two concurrent renames into one name keep both files", async () => {
    vol.fromJSON({
      "/anime/first.mkv": "first",
      "/anime/second.mkv": "second",
    })

    const results = await Promise.allSettled([
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/anime/Show - s01e01.mkv",
          oldPath: "/anime/first.mkv",
        }),
      ),
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/anime/Show - s01e01.mkv",
          oldPath: "/anime/second.mkv",
        }),
      ),
    ])

    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ])
    expect(
      vol.readFileSync("/anime/Show - s01e01.mkv", "utf8"),
    ).toBe("first")
    expect(
      vol.readFileSync("/anime/second.mkv", "utf8"),
    ).toBe("second")
    expect(vol.existsSync("/anime/first.mkv")).toBe(false)
  })

  test("releases the claim so a later rename into a freed name works", async () => {
    vol.fromJSON({
      "/anime/first.mkv": "first",
      "/anime/second.mkv": "second",
    })

    await firstValueFrom(
      renameFileOrFolder({
        newPath: "/anime/Show - s01e01.mkv",
        oldPath: "/anime/first.mkv",
      }),
    )
    vol.unlinkSync("/anime/Show - s01e01.mkv")
    await firstValueFrom(
      renameFileOrFolder({
        newPath: "/anime/Show - s01e01.mkv",
        oldPath: "/anime/second.mkv",
      }),
    )

    expect(
      vol.readFileSync("/anime/Show - s01e01.mkv", "utf8"),
    ).toBe("second")
  })

  test("does not rename when checking the target fails for a reason other than ENOENT", async () => {
    vol.fromJSON({
      "/anime/first.mkv": "first",
      "/anime/blocker": "a file, not a folder",
    })

    await expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/anime/blocker/Show - s01e01.mkv",
          oldPath: "/anime/first.mkv",
        }),
      ),
    ).rejects.toMatchObject({ code: "ENOTDIR" })
    expect(
      vol.readFileSync("/anime/first.mkv", "utf8"),
    ).toBe("first")
  })

  test("without hard links, a file that appears at the target is kept", async () => {
    vol.fromJSON({
      "/anime/first.mkv": "first",
    })
    vi.spyOn(fsPromises, "link").mockImplementationOnce(
      async () => {
        // Another writer takes the name after the absence check, and
        // the file system has no hard links.
        vol.writeFileSync(
          "/anime/Show - s01e01.mkv",
          "other",
        )
        throw Object.assign(new Error("EPERM: no links"), {
          code: "EPERM",
        })
      },
    )

    await expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/anime/Show - s01e01.mkv",
          oldPath: "/anime/first.mkv",
        }),
      ),
    ).rejects.toContain("already exists")
    expect(
      vol.readFileSync("/anime/Show - s01e01.mkv", "utf8"),
    ).toBe("other")
    expect(
      vol.readFileSync("/anime/first.mkv", "utf8"),
    ).toBe("first")
  })

  test("without hard links, a file still renames into a free name", async () => {
    vol.fromJSON({
      "/anime/first.mkv": "first",
    })
    vi.spyOn(fsPromises, "link").mockRejectedValueOnce(
      Object.assign(new Error("EPERM: no links"), {
        code: "EPERM",
      }),
    )

    await firstValueFrom(
      renameFileOrFolder({
        newPath: "/anime/Show - s01e01.mkv",
        oldPath: "/anime/first.mkv",
      }),
    )

    expect(
      vol.readFileSync("/anime/Show - s01e01.mkv", "utf8"),
    ).toBe("first")
    expect(vol.existsSync("/anime/first.mkv")).toBe(false)
  })

  test("renames a folder", async () => {
    vol.fromJSON({
      "/anime/Disc 1/episode.mkv": "episode",
    })

    await firstValueFrom(
      renameFileOrFolder({
        newPath: "/anime/Season 01",
        oldPath: "/anime/Disc 1",
      }),
    )

    expect(
      vol.readFileSync(
        "/anime/Season 01/episode.mkv",
        "utf8",
      ),
    ).toBe("episode")
    expect(vol.existsSync("/anime/Disc 1")).toBe(false)
  })
})

describe(createRenameFileOrFolderObservable.name, () => {
  test("completes when the old and new names are the same", async () => {
    expect(
      firstValueFrom(
        createRenameFileOrFolderObservable({
          fullPath:
            "/movies/Star Wars (1977)/Star Wars (1977).mkv",
          sourcePath: "/movies/Star Wars (1977)",
        })("Star Wars (1977)"),
      ),
    ).rejects.toThrow(EmptyError)
  })

  test("errors when the current file is missing", async () => {
    await captureLogMessage(
      "error",
      async (logMessageSpy) => {
        await expect(
          firstValueFrom(
            createRenameFileOrFolderObservable({
              fullPath:
                "/movies/Star Wars (1977)/Star Wars (1977).mkv",
              sourcePath: "/movies/Star Wars (1977)",
            })("Star Wars (1977) {edition-4K77}"),
          ),
        ).rejects.toThrow(EmptyError)

        expect(
          logMessageSpy.mock.calls[0].find(
            (error) =>
              error instanceof Error && error.message,
          ).message,
        ).toContain("no such file or directory")
      },
    )
  })

  test("errors when the renamed file already exists", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv":
        "",
    })

    await captureLogMessage(
      "error",
      async (logMessageSpy) => {
        await expect(
          firstValueFrom(
            createRenameFileOrFolderObservable({
              fullPath:
                "/movies/Star Wars (1977)/Star Wars (1977).mkv",
              sourcePath: "/movies/Star Wars (1977)",
            })("Star Wars (1977) {edition-4K77}"),
          ),
        ).rejects.toThrow(EmptyError)

        expect(
          logMessageSpy.mock.calls[0].find((text) =>
            text.includes("already exists"),
          ),
        ).toContain("already exists")
      },
    )
  })

  test("renames a file", async () => {
    vol.fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
    })

    await captureLogMessage(
      "info",
      async (logMessageSpy) => {
        await expect(
          firstValueFrom(
            createRenameFileOrFolderObservable({
              fullPath:
                "/movies/Star Wars (1977)/Star Wars (1977).mkv",
              sourcePath: "/movies/Star Wars (1977)",
            })("Star Wars (1977) {edition-4K77}"),
          ),
        ).resolves.toEqual({
          newPath: join(
            "/movies/Star Wars (1977)",
            "Star Wars (1977) {edition-4K77}.mkv",
          ),
          oldPath:
            "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        })

        const logMessageArgs = logMessageSpy.mock.calls[0]

        expect(
          logMessageArgs.find((text) =>
            text.includes("RENAMED"),
          ),
        ).toContain("RENAMED")

        expect(
          logMessageArgs.find((text) =>
            text.includes(
              "/movies/Star Wars (1977)/Star Wars (1977).mkv",
            ),
          ),
        ).toContain(
          "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        )

        expect(
          logMessageArgs.find((text) =>
            text.includes(
              join(
                "/movies/Star Wars (1977)",
                "Star Wars (1977) {edition-4K77}.mkv",
              ),
            ),
          ),
        ).toContain(
          join(
            "/movies/Star Wars (1977)",
            "Star Wars (1977) {edition-4K77}.mkv",
          ),
        )
      },
    )
  })
})
