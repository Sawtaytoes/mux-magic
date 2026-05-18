import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { copyFiles } from "./copyFiles.js"

describe(copyFiles.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  describe("basic copy (existing behaviour)", () => {
    test("synchronous unsubscribe aborts the AbortController so per-file copies are not started", async () => {
      const seedFiles: Record<string, string> = {}
      for (let index = 0; index < 8; index += 1) {
        seedFiles[`/cancel-src/file${index}.txt`] =
          "byte-".repeat(2000) + index
      }
      vol.fromJSON(seedFiles)

      const subscription = copyFiles({
        destinationPath: "/cancel-dst",
        sourcePath: "/cancel-src",
      }).subscribe()
      subscription.unsubscribe()

      await new Promise<void>((resolve) =>
        setTimeout(resolve, 50),
      )

      for (let index = 0; index < 8; index += 1) {
        expect(
          vol.existsSync(`/cancel-dst/file${index}.txt`),
        ).toBe(false)
      }
    })

    test("unsubscribing before the first file emission leaves no destination files", async () => {
      vol.fromJSON({
        "/sync-src/a.txt": "alpha",
        "/sync-src/b.txt": "beta",
      })

      const subscription = copyFiles({
        destinationPath: "/sync-dst",
        sourcePath: "/sync-src",
      }).subscribe()
      subscription.unsubscribe()

      await new Promise<void>((resolve) =>
        setTimeout(resolve, 50),
      )

      expect(vol.existsSync("/sync-dst/a.txt")).toBe(false)
      expect(vol.existsSync("/sync-dst/b.txt")).toBe(false)
    })

    test("emits one { source, destination } record per file copied", async () => {
      vol.fromJSON({
        "/src/ep01.mkv": "data1",
        "/src/ep02.mkv": "data2",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
        }).pipe(toArray()),
      )

      expect(
        results.sort((recordA, recordB) =>
          recordA.source.localeCompare(recordB.source),
        ),
      ).toEqual([
        {
          source: join("/src", "ep01.mkv"),
          destination: join("/dst", "ep01.mkv"),
        },
        {
          source: join("/src", "ep02.mkv"),
          destination: join("/dst", "ep02.mkv"),
        },
      ])
    })
  })

  describe("fileFilterRegex", () => {
    test("copies only files whose names match the regex", async () => {
      vol.fromJSON({
        "/src/[GroupName] Show - 01 [1080p].mkv": "ep1",
        "/src/[GroupName] Show - 02 [1080p].mkv": "ep2",
        "/src/readme.txt": "notes",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: "\\.mkv$",
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(2)
      expect(vol.existsSync("/dst/readme.txt")).toBe(false)
      expect(
        vol.existsSync(
          "/dst/[GroupName] Show - 01 [1080p].mkv",
        ),
      ).toBe(true)
    })

    test('matches case-insensitively when flags: "i" is set on the object form', async () => {
      vol.fromJSON({
        "/src/EPISODE-01.MKV": "ep1",
        "/src/episode-02.mkv": "ep2",
        "/src/readme.txt": "notes",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: {
            pattern: "\\.mkv$",
            flags: "i",
          },
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(2)
      expect(vol.existsSync("/dst/EPISODE-01.MKV")).toBe(
        true,
      )
      expect(vol.existsSync("/dst/episode-02.mkv")).toBe(
        true,
      )
    })

    test("legacy bare-string filter is still accepted", async () => {
      vol.fromJSON({
        "/src/a.mkv": "a",
        "/src/b.txt": "b",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: "\\.mkv$",
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(1)
      expect(vol.existsSync("/dst/a.mkv")).toBe(true)
      expect(vol.existsSync("/dst/b.txt")).toBe(false)
    })

    test("invalid pattern throws synchronously with field-name + pattern in the message", () => {
      vol.fromJSON({ "/src/a.mkv": "a" })

      expect(() =>
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: { pattern: "(unclosed" },
        }).subscribe(),
      ).toThrow(/fileFilterRegex.*\(unclosed/)
    })

    test("emits nothing when no files match the regex", async () => {
      vol.fromJSON({
        "/src/show.txt": "notes",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: "\\.mkv$",
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(0)
    })
  })

  describe("renameRegex", () => {
    test("applies pattern+replacement to the destination filename", async () => {
      vol.fromJSON({
        "/src/[Group] My Show - 01 [BD 1080p].mkv": "ep1",
        "/src/[Group] My Show - 02 [BD 1080p].mkv": "ep2",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          renameRegex: {
            pattern: "^\\[.*?\\] (.+?) \\[.*?\\](\\.\\w+)$",
            replacement: "$1$2",
          },
        }).pipe(toArray()),
      )

      expect(
        results.sort((recordA, recordB) =>
          recordA.destination.localeCompare(
            recordB.destination,
          ),
        ),
      ).toEqual([
        {
          source: join(
            "/src",
            "[Group] My Show - 01 [BD 1080p].mkv",
          ),
          destination: join("/dst", "My Show - 01.mkv"),
        },
        {
          source: join(
            "/src",
            "[Group] My Show - 02 [BD 1080p].mkv",
          ),
          destination: join("/dst", "My Show - 02.mkv"),
        },
      ])
      expect(vol.existsSync("/dst/My Show - 01.mkv")).toBe(
        true,
      )
      expect(vol.existsSync("/dst/My Show - 02.mkv")).toBe(
        true,
      )
    })
  })

  describe("renameRegex flags", () => {
    test('case-insensitive rename via flags: "i" rewrites mixed-case input', async () => {
      vol.fromJSON({
        "/src/EPISODE-01.MKV": "ep1",
        "/src/episode-02.mkv": "ep2",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          renameRegex: {
            pattern: "episode-(\\d+)\\.mkv",
            flags: "i",
            replacement: "Show - $1.mkv",
          },
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(2)
      expect(vol.existsSync("/dst/Show - 01.mkv")).toBe(
        true,
      )
      expect(vol.existsSync("/dst/Show - 02.mkv")).toBe(
        true,
      )
    })
  })

  describe("includeFolders", () => {
    test("copies matching folders as units when includeFolders is true", async () => {
      vol.fromJSON({
        "/src/My Show S01/ep01.mkv": "ep1",
        "/src/My Show S01/ep02.mkv": "ep2",
        "/src/My Show S02/ep01.mkv": "ep3",
        "/src/unrelated-file.txt": "skip",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          folderFilterRegex: "^My Show S\\d+$",
          isIncludingFolders: true,
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(2)
      expect(
        vol.existsSync("/dst/My Show S01/ep01.mkv"),
      ).toBe(true)
      expect(
        vol.existsSync("/dst/My Show S02/ep01.mkv"),
      ).toBe(true)
      expect(
        vol.existsSync("/dst/unrelated-file.txt"),
      ).toBe(false)
    })

    test("renames folders at destination when renameRegex provided", async () => {
      vol.fromJSON({
        "/src/[Group] My Show S01 [BD]/ep01.mkv": "ep1",
      })

      const results = await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          folderFilterRegex: "\\[Group\\]",
          isIncludingFolders: true,
          renameRegex: {
            pattern: "^\\[.*?\\] (.+?) \\[.*?\\]$",
            replacement: "$1",
          },
        }).pipe(toArray()),
      )

      expect(results).toHaveLength(1)
      expect(results[0].destination).toBe(
        join("/dst", "My Show S01"),
      )
      expect(
        vol.existsSync("/dst/My Show S01/ep01.mkv"),
      ).toBe(true)
    })

    test("copies both files and folders when both regexes and includeFolders are set", async () => {
      vol.fromJSON({
        "/src/ShowFolder/ep01.mkv": "ep1",
        "/src/loose.mkv": "loose",
        "/src/ignore.txt": "skip",
      })

      await firstValueFrom(
        copyFiles({
          sourcePath: "/src",
          destinationPath: "/dst",
          fileFilterRegex: "\\.mkv$",
          folderFilterRegex: "ShowFolder",
          isIncludingFolders: true,
        }).pipe(toArray()),
      )

      expect(
        vol.existsSync("/dst/ShowFolder/ep01.mkv"),
      ).toBe(true)
      expect(vol.existsSync("/dst/loose.mkv")).toBe(true)
      expect(vol.existsSync("/dst/ignore.txt")).toBe(false)
    })
  })
})
