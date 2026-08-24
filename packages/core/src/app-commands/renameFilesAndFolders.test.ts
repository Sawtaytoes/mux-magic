import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { renameFilesAndFolders } from "./renameFilesAndFolders.js"

describe(renameFilesAndFolders.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("renames matching files, and the extension is part of what the rule sees", async () => {
    vol.fromJSON({
      "/root/[Group] Ep 01.mkv": "x",
      "/root/[Group] Ep 02.mkv": "x",
    })

    const records = await firstValueFrom(
      renameFilesAndFolders({
        renameRegex: {
          flags: "u",
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
        sourcePath: "/root",
      }),
    )

    expect(
      records.map((record) => record.kind).toSorted(),
    ).toEqual(["renamed", "renamed"])
    expect(vol.existsSync("/root/Ep 01.mkv")).toBe(true)
    expect(vol.existsSync("/root/[Group] Ep 01.mkv")).toBe(
      false,
    )
  })

  test("renames folders as well as files — the gap renameFiles left", async () => {
    vol.fromJSON({ "/root/[Group] Season 1/01.mkv": "x" })

    await firstValueFrom(
      renameFilesAndFolders({
        isRenamingFiles: false,
        renameRegex: {
          flags: "u",
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
        sourcePath: "/root",
      }),
    )

    expect(vol.existsSync("/root/Season 1/01.mkv")).toBe(
      true,
    )
  })

  // Renaming a parent before its child invalidates every path already
  // planned below it, and the run dies with ENOENT part-way through.
  test("a nested rename does the child before the parent", async () => {
    vol.fromJSON({
      "/root/old-outer/old-inner/track.flac": "x",
    })

    const records = await firstValueFrom(
      renameFilesAndFolders({
        isRenamingFiles: false,
        recursiveDepth: 2,
        renameRegex: {
          flags: "u",
          pattern: "^old-",
          replacement: "new-",
        },
        sourcePath: "/root",
      }),
    )

    expect(
      records.filter((record) => record.kind === "renamed"),
    ).toHaveLength(2)
    expect(
      vol.existsSync(
        "/root/new-outer/new-inner/track.flac",
      ),
    ).toBe(true)
  })

  test("a collision is a skip, never an overwrite", async () => {
    vol.fromJSON({
      "/root/a.txt": "keep me",
      "/root/b.txt": "rename me",
    })

    const records = await firstValueFrom(
      renameFilesAndFolders({
        renameRegex: {
          flags: "u",
          pattern: "^b\\.txt$",
          replacement: "a.txt",
        },
        sourcePath: "/root",
      }),
    )

    expect(
      records.find((record) => record.kind === "skipped"),
    ).toBeDefined()
    expect(vol.readFileSync("/root/a.txt", "utf8")).toBe(
      "keep me",
    )
    expect(vol.existsSync("/root/b.txt")).toBe(true)
  })

  test("a dry run reports the plan and touches nothing", async () => {
    vol.fromJSON({ "/root/[Group] Ep 01.mkv": "x" })

    const records = await firstValueFrom(
      renameFilesAndFolders({
        isDryRun: true,
        renameRegex: {
          flags: "u",
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
        sourcePath: "/root",
      }),
    )

    expect(records[0]).toMatchObject({
      destination: "/root/Ep 01.mkv",
      isDryRun: true,
      kind: "renamed",
    })
    expect(vol.existsSync("/root/[Group] Ep 01.mkv")).toBe(
      true,
    )
    expect(vol.existsSync("/root/Ep 01.mkv")).toBe(false)
  })

  test("an entry the rule does not change is reported unchanged", async () => {
    vol.fromJSON({ "/root/already-clean.mkv": "x" })

    const records = await firstValueFrom(
      renameFilesAndFolders({
        renameRegex: {
          flags: "u",
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
        sourcePath: "/root",
      }),
    )

    expect(records[0].kind).toBe("unchanged")
  })

  test("the name filter keeps the rule off everything else", async () => {
    vol.fromJSON({
      "/root/keep-me.txt": "x",
      "/root/x-rename-me.txt": "x",
    })

    await firstValueFrom(
      renameFilesAndFolders({
        nameFilterRegex: "^x-",
        renameRegex: {
          flags: "u",
          pattern: "^x-",
          replacement: "",
        },
        sourcePath: "/root",
      }),
    )

    expect(vol.existsSync("/root/keep-me.txt")).toBe(true)
    expect(vol.existsSync("/root/rename-me.txt")).toBe(true)
  })

  test("an invalid pattern throws at the call site, before anything is touched", () => {
    vol.fromJSON({ "/root/a.txt": "x" })

    expect(() =>
      renameFilesAndFolders({
        renameRegex: { pattern: "([", replacement: "" },
        sourcePath: "/root",
      }),
    ).toThrow()
  })
})
