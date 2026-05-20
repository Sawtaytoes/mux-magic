import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { flattenChildFolders } from "./flattenChildFolders.js"

describe(flattenChildFolders.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  test("moves every immediate child folder's files up to parentPath", async () => {
    vol.fromJSON({
      "/shorts/disc1/ep01.mkv": "ep1",
      "/shorts/disc1/ep02.mkv": "ep2",
      "/shorts/disc2/ep03.mkv": "ep3",
    })

    const results = await firstValueFrom(
      flattenChildFolders({
        parentPath: "/shorts",
      }).pipe(toArray()),
    )

    const destinations = results
      .map((record) => record.destination)
      .sort()
    expect(destinations).toEqual([
      join("/shorts", "ep01.mkv"),
      join("/shorts", "ep02.mkv"),
      join("/shorts", "ep03.mkv"),
    ])
    expect(vol.existsSync("/shorts/ep01.mkv")).toBe(true)
    expect(vol.existsSync("/shorts/ep02.mkv")).toBe(true)
    expect(vol.existsSync("/shorts/ep03.mkv")).toBe(true)
    expect(vol.existsSync("/shorts/disc1/ep01.mkv")).toBe(
      false,
    )
  })

  test("files already at parentPath are untouched", async () => {
    vol.fromJSON({
      "/shorts/already-here.mkv": "kept",
      "/shorts/disc1/ep01.mkv": "ep1",
    })

    const results = await firstValueFrom(
      flattenChildFolders({
        parentPath: "/shorts",
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(1)
    expect(vol.existsSync("/shorts/already-here.mkv")).toBe(
      true,
    )
    expect(vol.existsSync("/shorts/ep01.mkv")).toBe(true)
  })

  test("default flag preserves the now-empty child folders", async () => {
    vol.fromJSON({
      "/shorts/disc1/ep01.mkv": "ep1",
    })

    await firstValueFrom(
      flattenChildFolders({
        parentPath: "/shorts",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/shorts/disc1")).toBe(true)
    expect(vol.existsSync("/shorts/ep01.mkv")).toBe(true)
  })

  test("flag-on removes the now-empty child folders", async () => {
    vol.fromJSON({
      "/shorts/disc1/ep01.mkv": "ep1",
      "/shorts/disc2/ep02.mkv": "ep2",
    })

    await firstValueFrom(
      flattenChildFolders({
        isDeletingEmptyChildFoldersAfterFlattening: true,
        parentPath: "/shorts",
      }).pipe(toArray()),
    )

    expect(vol.existsSync("/shorts/disc1")).toBe(false)
    expect(vol.existsSync("/shorts/disc2")).toBe(false)
    expect(vol.existsSync("/shorts/ep01.mkv")).toBe(true)
    expect(vol.existsSync("/shorts/ep02.mkv")).toBe(true)
  })

  test("does not recurse into grandchildren — only immediate child dirs are processed", async () => {
    vol.fromJSON({
      "/shorts/disc1/ep01.mkv": "ep1",
      "/shorts/disc1/extras/bonus.mkv": "bonus",
    })

    const results = await firstValueFrom(
      flattenChildFolders({
        parentPath: "/shorts",
      }).pipe(toArray()),
    )

    expect(results).toHaveLength(1)
    expect(vol.existsSync("/shorts/ep01.mkv")).toBe(true)
    expect(
      vol.existsSync("/shorts/disc1/extras/bonus.mkv"),
    ).toBe(true)
    expect(vol.existsSync("/shorts/bonus.mkv")).toBe(false)
  })

  test("empty parent — no emissions, no crash", async () => {
    vol.mkdirSync("/empty-parent", { recursive: true })

    const results = await firstValueFrom(
      flattenChildFolders({
        parentPath: "/empty-parent",
      }).pipe(toArray()),
    )

    expect(results).toEqual([])
  })
})
