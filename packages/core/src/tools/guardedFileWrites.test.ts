import { readFile, stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  assertWritablePaths,
  makeDirectory,
  mkdir,
  rename,
  renameFileOrFolder,
  rm,
  unlink,
  writeFile,
} from "./guardedFileWrites.js"
import { PathSafetyError } from "./pathSafety.js"

vi.mock("./currentEnvironment.js", () => ({
  getCwd: () => "/media/show",
  getPlatform: () => "linux",
}))

const originalAllowedFileRoots =
  process.env.ALLOWED_FILE_ROOTS
const originalIsContainerized = process.env.IS_CONTAINERIZED

const restoreEnvironmentVariable = (
  name: string,
  value: string | undefined,
) => {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

beforeEach(() => {
  delete process.env.ALLOWED_FILE_ROOTS
  delete process.env.IS_CONTAINERIZED
  vol.fromJSON({
    "/media/show/episode.mkv": "episode",
    "/outside/secret.txt": "secret",
    "/outside/folder/kept.srt": "kept",
  })
  vol.symlinkSync(
    "/outside/secret.txt",
    "/media/show/link.txt",
  )
  vol.symlinkSync(
    "/outside/folder",
    "/media/show/linked-folder",
  )
})

afterEach(() => {
  restoreEnvironmentVariable(
    "ALLOWED_FILE_ROOTS",
    originalAllowedFileRoots,
  )
  restoreEnvironmentVariable(
    "IS_CONTAINERIZED",
    originalIsContainerized,
  )
})

describe("with no allowed roots (a source install or the desktop CLI)", () => {
  test("writes anywhere, as before", async () => {
    await writeFile("/outside/new.txt", "new")

    await expect(
      readFile("/outside/new.txt", "utf8"),
    ).resolves.toBe("new")
  })

  test("accepts a relative path", () => {
    expect(() => {
      assertWritablePaths({
        isLinkFollowed: true,
        paths: ["../../anywhere/notes.txt"],
      })
    }).not.toThrow()
  })
})

describe("with ALLOWED_FILE_ROOTS set", () => {
  beforeEach(() => {
    process.env.ALLOWED_FILE_ROOTS = "/media"
  })

  test("writes a file inside the root", async () => {
    await writeFile("/media/show/episode.ass", "subtitles")

    await expect(
      readFile("/media/show/episode.ass", "utf8"),
    ).resolves.toBe("subtitles")
  })

  test("refuses a write outside the root and leaves the disk unchanged", async () => {
    await expect(
      writeFile("/outside/new.txt", "new"),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(stat("/outside/new.txt")).rejects.toThrow()
  })

  // The working directory is mocked as /media/show.
  test("accepts a relative path that resolves inside the root", () => {
    expect(() => {
      assertWritablePaths({
        isLinkFollowed: true,
        paths: ["episode.ass"],
      })
    }).not.toThrow()
  })

  test("refuses a relative path that resolves outside the root", async () => {
    await expect(
      writeFile("../../outside/new.txt", "new"),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(stat("/outside/new.txt")).rejects.toThrow()
  })

  test("refuses a write through a file link that points outside the root", async () => {
    await expect(
      writeFile("/media/show/link.txt", "overwritten"),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(
      readFile("/outside/secret.txt", "utf8"),
    ).resolves.toBe("secret")
  })

  test("still deletes the link itself, because only the link inside the root changes", async () => {
    await unlink("/media/show/link.txt")

    await expect(
      readFile("/outside/secret.txt", "utf8"),
    ).resolves.toBe("secret")
  })

  test("refuses a delete reached by descending through a folder link that points outside the root", async () => {
    await expect(
      unlink("/media/show/linked-folder/kept.srt"),
    ).rejects.toBeInstanceOf(PathSafetyError)
    await expect(
      rm("/media/show/linked-folder/kept.srt", {
        force: true,
      }),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(
      readFile("/outside/folder/kept.srt", "utf8"),
    ).resolves.toBe("kept")
  })

  test("refuses a folder created through a folder link that points outside the root", async () => {
    await expect(
      mkdir("/media/show/linked-folder/NEW", {
        recursive: true,
      }),
    ).rejects.toBeInstanceOf(PathSafetyError)
    await expect(
      firstValueFrom(makeDirectory("/outside/NEW")),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(
      stat("/outside/folder/NEW"),
    ).rejects.toThrow()
    await expect(stat("/outside/NEW")).rejects.toThrow()
  })

  test("refuses a rename that moves a file out of the root and keeps the source", async () => {
    await expect(
      rename(
        "/media/show/episode.mkv",
        "/outside/episode.mkv",
      ),
    ).rejects.toBeInstanceOf(PathSafetyError)
    await expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/outside/episode.mkv",
          oldPath: "/media/show/episode.mkv",
        }),
      ),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(
      readFile("/media/show/episode.mkv", "utf8"),
    ).resolves.toBe("episode")
    await expect(
      stat("/outside/episode.mkv"),
    ).rejects.toThrow()
  })

  test("refuses a rename that moves a file from outside into the root", async () => {
    await expect(
      rename(
        "/outside/secret.txt",
        "/media/show/secret.txt",
      ),
    ).rejects.toBeInstanceOf(PathSafetyError)

    await expect(
      readFile("/outside/secret.txt", "utf8"),
    ).resolves.toBe("secret")
  })

  test("renames inside the root", async () => {
    await rename(
      "/media/show/episode.mkv",
      "/media/show/Episode 01.mkv",
    )

    await expect(
      readFile("/media/show/Episode 01.mkv", "utf8"),
    ).resolves.toBe("episode")
  })
})

describe("in a container with no ALLOWED_FILE_ROOTS", () => {
  beforeEach(() => {
    process.env.IS_CONTAINERIZED = "true"
  })

  test("limits writes to /media", async () => {
    await writeFile("/media/show/episode.ass", "subtitles")

    await expect(
      writeFile("/outside/new.txt", "new"),
    ).rejects.toBeInstanceOf(PathSafetyError)
    await expect(
      readFile("/media/show/episode.ass", "utf8"),
    ).resolves.toBe("subtitles")
  })
})
