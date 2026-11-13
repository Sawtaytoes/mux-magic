import { delimiter, normalize, sep } from "node:path"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import {
  findCommandPathsOutsideAllowedRoots,
  getAllowedFileRoots,
  PathSafetyError,
  validateReadablePath,
  validateWritablePath,
} from "./pathSafety.js"

// Branch on the path module's `sep` (resolved at import time per the host
// OS) rather than `process.platform` — the test setup pins
// `process.platform` to "linux" so the `assertNotDriveRelative` guard
// stays inert against POSIX memfs fixtures, but `path.normalize` keeps
// its host-OS behavior, so the platform-specific *input* the test feeds
// in has to match the path module's flavor.
const isWindowsPathModule = sep === "\\"

describe(validateReadablePath.name, () => {
  test("returns the normalized path for a valid absolute path", () => {
    const input = isWindowsPathModule
      ? "C:\\Users\\foo"
      : "/home/foo"
    expect(validateReadablePath(input)).toBe(input)
  })

  test("rejects empty string", () => {
    expect(() => validateReadablePath("")).toThrow(
      PathSafetyError,
    )
  })

  test("rejects relative paths", () => {
    expect(() =>
      validateReadablePath("relative/dir"),
    ).toThrow(/must be absolute/)
  })

  test("rejects a traversal segment that normalize would collapse", () => {
    const input = isWindowsPathModule
      ? "C:\\Users\\..\\..\\..\\Windows"
      : "/home/foo/../../../etc"
    expect(() => validateReadablePath(input)).toThrow(
      /traversal not allowed/,
    )
  })

  test("rejects a traversal segment written with backslashes", () => {
    expect(() =>
      validateReadablePath("/media/Anime\\..\\..\\etc"),
    ).toThrow(/traversal not allowed/)
  })

  test("accepts a name that only contains dots", () => {
    expect(
      validateReadablePath("/media/Anime/Show..Name"),
    ).toBe(normalize("/media/Anime/Show..Name"))
  })
})

describe(validateWritablePath.name, () => {
  const originalRoots = process.env.ALLOWED_FILE_ROOTS
  const originalIsContainerized =
    process.env.IS_CONTAINERIZED

  const restoreEnvironment = (
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
  })

  afterEach(() => {
    restoreEnvironment("ALLOWED_FILE_ROOTS", originalRoots)
    restoreEnvironment(
      "IS_CONTAINERIZED",
      originalIsContainerized,
    )
  })

  test("a local install with no roots set has no limit", () => {
    expect(getAllowedFileRoots()).toBe(null)
    expect(validateWritablePath("/home/foo/file.mkv")).toBe(
      normalize("/home/foo/file.mkv"),
    )
  })

  test("a container with no roots set is limited to /media", () => {
    process.env.IS_CONTAINERIZED = "true"

    expect(getAllowedFileRoots()).toEqual(["/media"])
    expect(
      validateWritablePath("/media/Anime/ep.mkv"),
    ).toBe(normalize("/media/Anime/ep.mkv"))
    expect(() =>
      validateWritablePath(
        "/app/packages/web/dist/index.html",
      ),
    ).toThrow(/outside the allowed file roots/)
  })

  test("ALLOWED_FILE_ROOTS replaces the default", () => {
    process.env.IS_CONTAINERIZED = "true"
    process.env.ALLOWED_FILE_ROOTS = [
      "/srv/media",
      "/data",
    ].join(delimiter)

    expect(validateWritablePath("/data/ep.mkv")).toBe(
      normalize("/data/ep.mkv"),
    )
    expect(validateWritablePath("/srv/media")).toBe(
      normalize("/srv/media"),
    )
    expect(() =>
      validateWritablePath("/media/Anime/ep.mkv"),
    ).toThrow(/outside the allowed file roots/)
  })

  test("a sibling folder that shares the root's prefix is outside", () => {
    process.env.ALLOWED_FILE_ROOTS = "/media"

    expect(() =>
      validateWritablePath("/media-other/ep.mkv"),
    ).toThrow(/outside the allowed file roots/)
  })

  test("traversal out of a root is refused", () => {
    process.env.ALLOWED_FILE_ROOTS = "/media"

    expect(() =>
      validateWritablePath("/media/../etc/passwd"),
    ).toThrow(/traversal not allowed/)
  })
})

describe(findCommandPathsOutsideAllowedRoots.name, () => {
  const originalRoots = process.env.ALLOWED_FILE_ROOTS

  afterEach(() => {
    if (originalRoots === undefined) {
      delete process.env.ALLOWED_FILE_ROOTS
    } else {
      process.env.ALLOWED_FILE_ROOTS = originalRoots
    }
  })

  test("reports each path parameter outside the roots, including arrays", () => {
    process.env.ALLOWED_FILE_ROOTS = "/media"

    expect(
      findCommandPathsOutsideAllowedRoots({
        destinationPath: "/media/Movies",
        pathsToDelete: ["/media/a.mkv", "/outside/b.mkv"],
        sourcePath: "/outside",
      }).map((problem) => problem.split(":")[0]),
    ).toEqual(["pathsToDelete", "sourcePath"])
  })

  test("ignores rootPath, which names a media player's path", () => {
    process.env.ALLOWED_FILE_ROOTS = "/media"

    expect(
      findCommandPathsOutsideAllowedRoots({
        rootPath: "/data/movies",
        sourcePath: "/media/Movies",
      }),
    ).toEqual([])
  })

  test("reports nothing when there is no limit", () => {
    delete process.env.ALLOWED_FILE_ROOTS

    expect(
      findCommandPathsOutsideAllowedRoots({
        sourcePath: "relative/path",
      }),
    ).toEqual([])
  })
})
