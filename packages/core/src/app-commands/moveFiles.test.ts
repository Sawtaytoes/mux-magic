import * as fsPromises from "node:fs/promises"
import { stat } from "node:fs/promises"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { moveFiles } from "./moveFiles.js"

describe(moveFiles.name, () => {
  beforeEach(() => {
    vol.reset()
    vol.fromJSON({
      "/work/OUT/episode-01.mkv": "ep1",
      "/work/OUT/episode-02.mkv": "ep2",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("emits one { source, destination } per file moved", async () => {
    const results = await firstValueFrom(
      moveFiles({
        sourcePath: "/work/OUT",
        destinationPath: "/work",
      }).pipe(toArray()),
    )

    expect(
      results.sort((itemA, itemB) =>
        itemA.source.localeCompare(itemB.source),
      ),
    ).toEqual([
      {
        source: join("/work/OUT", "episode-01.mkv"),
        destination: join("/work", "episode-01.mkv"),
      },
      {
        source: join("/work/OUT", "episode-02.mkv"),
        destination: join("/work", "episode-02.mkv"),
      },
    ])
  })

  test("moves each file off the source and into the destination", async () => {
    await firstValueFrom(
      moveFiles({
        sourcePath: "/work/OUT",
        destinationPath: "/work",
      }).pipe(toArray()),
    )

    // Worker 59: source directory is no longer rm -r'd. Each file is
    // gone from source (renamed away), but the parent dir survives.
    await expect(stat("/work/OUT")).resolves.toBeDefined()
    expect(vol.existsSync("/work/OUT/episode-01.mkv")).toBe(
      false,
    )
    expect(vol.existsSync("/work/OUT/episode-02.mkv")).toBe(
      false,
    )
    await expect(
      stat("/work/episode-01.mkv"),
    ).resolves.toBeDefined()
    await expect(
      stat("/work/episode-02.mkv"),
    ).resolves.toBeDefined()
  })

  test("preserves filtered-out files (and the source dir) when fileFilterRegex is set", async () => {
    vol.reset()
    vol.fromJSON({
      "/filter-src/ep01.mkv": "ep1",
      "/filter-src/notes.txt": "notes",
    })

    await firstValueFrom(
      moveFiles({
        sourcePath: "/filter-src",
        destinationPath: "/filter-dst",
        fileFilterRegex: "\\.mkv$",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/filter-dst/ep01.mkv")).toBe(
      true,
    )
    expect(vol.existsSync("/filter-dst/notes.txt")).toBe(
      false,
    )
    // Filtered-out file is still in the source dir, and the source
    // dir itself was NOT removed — the trailing `rm -r` would have
    // wiped notes.txt with the old behavior.
    expect(vol.existsSync("/filter-src/notes.txt")).toBe(
      true,
    )
    await expect(stat("/filter-src")).resolves.toBeDefined()
  })

  describe("renameRegex", () => {
    test("applies rename pattern to destination filename", async () => {
      vol.reset()
      vol.fromJSON({
        "/ren-src/[Group] Show - 01.mkv": "ep1",
      })

      const results = await firstValueFrom(
        moveFiles({
          sourcePath: "/ren-src",
          destinationPath: "/ren-dst",
          renameRegex: {
            pattern: "^\\[.*?\\] (.+)$",
            replacement: "$1",
          },
        }).pipe(toArray()),
      )

      expect(results[0].destination).toBe(
        join("/ren-dst", "Show - 01.mkv"),
      )
      expect(vol.existsSync("/ren-dst/Show - 01.mkv")).toBe(
        true,
      )
    })
  })

  describe("allowOverwrite", () => {
    test("refuses to clobber an existing destination by default", async () => {
      vol.reset()
      vol.fromJSON({
        "/mv-src/episode-01.mkv": "fresh",
        "/mv-dst/episode-01.mkv": "stale",
      })

      await expect(
        firstValueFrom(
          moveFiles({
            sourcePath: "/mv-src",
            destinationPath: "/mv-dst",
          }).pipe(toArray()),
        ),
      ).rejects.toMatchObject({ code: "EEXIST" })

      // Stale destination untouched, source still present.
      expect(
        vol.readFileSync("/mv-dst/episode-01.mkv", "utf8"),
      ).toBe("stale")
      expect(vol.existsSync("/mv-src/episode-01.mkv")).toBe(
        true,
      )
    })

    test("overwrites when allowOverwrite is true", async () => {
      vol.reset()
      vol.fromJSON({
        "/mv-src/episode-01.mkv": "fresh",
        "/mv-dst/episode-01.mkv": "stale",
      })

      await firstValueFrom(
        moveFiles({
          sourcePath: "/mv-src",
          destinationPath: "/mv-dst",
          isOverwriteAllowed: true,
        }).pipe(toArray()),
      )

      expect(
        vol.readFileSync("/mv-dst/episode-01.mkv", "utf8"),
      ).toBe("fresh")
      expect(vol.existsSync("/mv-src/episode-01.mkv")).toBe(
        false,
      )
    })
  })

  describe("EXDEV fallback", () => {
    test("falls back to copy+unlink when fs.rename throws EXDEV", async () => {
      vol.reset()
      vol.fromJSON({
        "/xdev-src/episode-01.mkv": "ep1 bytes",
      })

      const renameSpy = vi
        .spyOn(fsPromises, "rename")
        .mockImplementationOnce(async () => {
          const error = new Error(
            "EXDEV: cross-device link not permitted",
          ) as Error & { code: string }
          error.code = "EXDEV"
          throw error
        })

      await firstValueFrom(
        moveFiles({
          sourcePath: "/xdev-src",
          destinationPath: "/xdev-dst",
        }).pipe(toArray()),
      )

      // First rename call (the fast-path attempt) threw EXDEV; the
      // EXDEV branch invoked aclSafeCopyFile which performs its own
      // temp+rename and then unlinks the source. Net effect: bytes
      // moved, source gone, NO `*.muxmagic.tmp` left behind.
      expect(
        vol.readFileSync(
          "/xdev-dst/episode-01.mkv",
          "utf8",
        ),
      ).toBe("ep1 bytes")
      expect(
        vol.existsSync("/xdev-src/episode-01.mkv"),
      ).toBe(false)
      expect(
        vol.existsSync(
          "/xdev-dst/episode-01.mkv.muxmagic.tmp",
        ),
      ).toBe(false)
      // Spy was invoked at least twice: the fast-path attempt
      // (mock-rejected with EXDEV) and the temp→destination rename
      // inside aclSafeCopyFile (passed through to the real impl).
      expect(
        renameSpy.mock.calls.length,
      ).toBeGreaterThanOrEqual(2)
    })
  })
})
