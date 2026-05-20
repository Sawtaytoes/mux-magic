import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { distributeFolderToSiblings } from "./distributeFolderToSiblings.js"

describe(distributeFolderToSiblings.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("copies source folder into every sibling, skipping the source itself", async () => {
    vol.fromJSON({
      "/show/attachments/font.ttf": "fontdata",
      "/show/ep01/keep.txt": "ep1",
      "/show/ep02/keep.txt": "ep2",
    })

    const results = await firstValueFrom(
      distributeFolderToSiblings({
        sourceFolderPath: "/show/attachments",
      }).pipe(toArray()),
    )

    const destinations = results
      .map((record) => record.destination)
      .sort()
    expect(destinations).toEqual([
      join("/show", "ep01", "attachments", "font.ttf"),
      join("/show", "ep02", "attachments", "font.ttf"),
    ])
    expect(
      vol.existsSync("/show/ep01/attachments/font.ttf"),
    ).toBe(true)
    expect(
      vol.existsSync("/show/ep02/attachments/font.ttf"),
    ).toBe(true)
    expect(
      vol.existsSync("/show/attachments/attachments"),
    ).toBe(false)
  })

  test("default flag preserves the source folder", async () => {
    vol.fromJSON({
      "/show/attachments/font.ttf": "fontdata",
      "/show/ep01/keep.txt": "ep1",
    })

    await firstValueFrom(
      distributeFolderToSiblings({
        sourceFolderPath: "/show/attachments",
      }).pipe(toArray()),
    )

    expect(
      vol.existsSync("/show/attachments/font.ttf"),
    ).toBe(true)
    expect(
      vol.existsSync("/show/ep01/attachments/font.ttf"),
    ).toBe(true)
  })

  test("flag-on removes the source folder after distribution", async () => {
    vol.fromJSON({
      "/show/attachments/font.ttf": "fontdata",
      "/show/ep01/keep.txt": "ep1",
    })

    await firstValueFrom(
      distributeFolderToSiblings({
        isDeletingSourceFolderAfterDistributing: true,
        sourceFolderPath: "/show/attachments",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/show/attachments")).toBe(false)
    expect(
      vol.existsSync("/show/ep01/attachments/font.ttf"),
    ).toBe(true)
  })

  test("no siblings — completes with no emissions and does not crash", async () => {
    vol.fromJSON({
      "/show/attachments/font.ttf": "fontdata",
    })

    const results = await firstValueFrom(
      distributeFolderToSiblings({
        sourceFolderPath: "/show/attachments",
      }).pipe(toArray()),
    )

    expect(results).toEqual([])
    expect(
      vol.existsSync("/show/attachments/font.ttf"),
    ).toBe(true)
  })

  test("recurses into nested source content", async () => {
    vol.fromJSON({
      "/show/attachments/font.ttf": "fontdata",
      "/show/attachments/sub/extra.bin": "extra",
      "/show/ep01/keep.txt": "ep1",
    })

    const results = await firstValueFrom(
      distributeFolderToSiblings({
        sourceFolderPath: "/show/attachments",
      }).pipe(toArray()),
    )

    const destinations = results
      .map((record) => record.destination)
      .sort()
    expect(destinations).toEqual([
      join("/show", "ep01", "attachments", "font.ttf"),
      join(
        "/show",
        "ep01",
        "attachments",
        "sub",
        "extra.bin",
      ),
    ])
    expect(
      vol.existsSync(
        "/show/ep01/attachments/sub/extra.bin",
      ),
    ).toBe(true)
  })
})
