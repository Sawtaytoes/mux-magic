import { join } from "node:path"
import { vol } from "memfs"
import {
  firstValueFrom,
  lastValueFrom,
  toArray,
} from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { renameFiles } from "./renameFiles.js"

describe(renameFiles.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("renames every file in the directory when no fileFilterRegex is provided", async () => {
    vol.fromJSON({
      "/src/[Group] Show - 01.mkv": "ep1",
      "/src/[Group] Show - 02.mkv": "ep2",
      "/src/[Group] Show - 03.mkv": "ep3",
    })

    const results = await firstValueFrom(
      renameFiles({
        sourcePath: "/src",
        renameRegex: {
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
      }).pipe(toArray()),
    )

    expect(
      results.sort((recordA, recordB) =>
        recordA.source.localeCompare(recordB.source),
      ),
    ).toEqual([
      {
        source: join("/src", "[Group] Show - 01.mkv"),
        destination: join("/src", "Show - 01.mkv"),
      },
      {
        source: join("/src", "[Group] Show - 02.mkv"),
        destination: join("/src", "Show - 02.mkv"),
      },
      {
        source: join("/src", "[Group] Show - 03.mkv"),
        destination: join("/src", "Show - 03.mkv"),
      },
    ])

    expect(vol.existsSync("/src/Show - 01.mkv")).toBe(true)
    expect(vol.existsSync("/src/Show - 02.mkv")).toBe(true)
    expect(vol.existsSync("/src/Show - 03.mkv")).toBe(true)
    expect(
      vol.existsSync("/src/[Group] Show - 01.mkv"),
    ).toBe(false)
  })

  test("only renames files matching fileFilterRegex", async () => {
    vol.fromJSON({
      "/src/[Group] Show - 01.mkv": "ep1",
      "/src/[Group] Show - 02.mkv": "ep2",
      "/src/readme.txt": "notes",
    })

    const results = await firstValueFrom(
      renameFiles({
        sourcePath: "/src",
        fileFilterRegex: "\\.mkv$",
        renameRegex: {
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(2)
    expect(vol.existsSync("/src/Show - 01.mkv")).toBe(true)
    expect(vol.existsSync("/src/readme.txt")).toBe(true)
  })

  test("skips files whose name does not change after the regex is applied", async () => {
    vol.fromJSON({
      "/src/[Group] Show - 01.mkv": "ep1",
      "/src/clean.mkv": "already clean",
    })

    const results = await firstValueFrom(
      renameFiles({
        sourcePath: "/src",
        renameRegex: {
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      source: join("/src", "[Group] Show - 01.mkv"),
      destination: join("/src", "Show - 01.mkv"),
    })
    expect(vol.existsSync("/src/clean.mkv")).toBe(true)
  })

  test("halts before any rename when two targets collide (after rename)", async () => {
    vol.fromJSON({
      "/src/[GroupA] Show - 01.mkv": "epA",
      "/src/[GroupB] Show - 01.mkv": "epB",
      "/src/Other.mkv": "other",
    })

    await expect(
      lastValueFrom(
        renameFiles({
          sourcePath: "/src",
          renameRegex: {
            pattern: "^\\[Group.\\] ",
            replacement: "",
          },
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(/collision/i)

    expect(
      vol.existsSync("/src/[GroupA] Show - 01.mkv"),
    ).toBe(true)
    expect(
      vol.existsSync("/src/[GroupB] Show - 01.mkv"),
    ).toBe(true)
    expect(vol.existsSync("/src/Other.mkv")).toBe(true)
    expect(vol.existsSync("/src/Show - 01.mkv")).toBe(false)
  })

  test("detects case-only collisions on a case-insensitive filesystem (lowercased target)", async () => {
    vol.fromJSON({
      "/src/Foo - 01.mkv": "ep1",
      "/src/Bar Foo - 01.mkv": "ep2",
    })

    await expect(
      lastValueFrom(
        renameFiles({
          sourcePath: "/src",
          renameRegex: {
            pattern: "^.*?(Foo - 01\\.mkv)$",
            replacement: "foo - 01.mkv",
          },
        }).pipe(toArray()),
      ),
    ).rejects.toThrow(/collision/i)
  })

  test("descends into subdirectories when isRecursive is true", async () => {
    vol.fromJSON({
      "/src/[Group] depth1.mkv": "a",
      "/src/sub/[Group] depth2.mkv": "b",
      "/src/sub/nested/[Group] depth3.mkv": "c",
    })

    const results = await firstValueFrom(
      renameFiles({
        sourcePath: "/src",
        isRecursive: true,
        recursiveDepth: 2,
        renameRegex: {
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(3)
    expect(vol.existsSync("/src/depth1.mkv")).toBe(true)
    expect(vol.existsSync("/src/sub/depth2.mkv")).toBe(true)
    expect(
      vol.existsSync("/src/sub/nested/depth3.mkv"),
    ).toBe(true)
  })

  test("non-recursive mode leaves nested files untouched", async () => {
    vol.fromJSON({
      "/src/[Group] top.mkv": "a",
      "/src/sub/[Group] nested.mkv": "b",
    })

    const results = await firstValueFrom(
      renameFiles({
        sourcePath: "/src",
        renameRegex: {
          pattern: "^\\[Group\\] ",
          replacement: "",
        },
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(1)
    expect(vol.existsSync("/src/top.mkv")).toBe(true)
    expect(
      vol.existsSync("/src/sub/[Group] nested.mkv"),
    ).toBe(true)
  })

  test("synchronous unsubscribe aborts before any rename happens", async () => {
    vol.fromJSON({
      "/src/[Group] a.mkv": "a",
      "/src/[Group] b.mkv": "b",
    })

    const subscription = renameFiles({
      sourcePath: "/src",
      renameRegex: {
        pattern: "^\\[Group\\] ",
        replacement: "",
      },
    }).subscribe()
    subscription.unsubscribe()

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 50),
    )

    expect(vol.existsSync("/src/[Group] a.mkv")).toBe(true)
    expect(vol.existsSync("/src/[Group] b.mkv")).toBe(true)
  })
})
