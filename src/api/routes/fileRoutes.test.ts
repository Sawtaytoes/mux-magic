import { stat } from "node:fs/promises"
import { normalize as normalizePath } from "node:path"

import { vol } from "memfs"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { fileRoutes } from "./fileRoutes.js"

// Hono in-process tests for the file routes. Filesystem ops are routed
// through memfs (globally mocked in vitest.setup.ts) so each test can
// seed a virtual tree with `vol.fromJSON` and assert on what survives.

const post = (path: string, body: unknown) => (
  fileRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
)

describe("POST /files/rename", () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/old-name.mkv": "video bytes",
      "/work/sibling.mkv": "another video",
    })
  })

  afterEach(() => {
    vol.reset()
  })

  test("renames a file when both paths are absolute and the destination is free", async () => {
    const response = await post("/files/rename", {
      oldPath: "/work/old-name.mkv",
      newPath: "/work/new-name.mkv",
    })
    const body = await response.json() as { ok: boolean; newPath: string | null; error: string | null }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    // validateReadablePath returns the normalized path, so on Windows the
    // forward-slash input comes back as `\work\new-name.mkv`. Normalize
    // the expected value the same way to keep the assertion portable.
    expect(body.newPath).toBe(normalizePath("/work/new-name.mkv"))
    expect(body.error).toBeNull()

    const newStats = await stat("/work/new-name.mkv")
    expect(newStats.isFile()).toBe(true)
    await expect(stat("/work/old-name.mkv")).rejects.toThrow()
  })

  test("rejects relative oldPath with a path-safety error and leaves the filesystem untouched", async () => {
    const response = await post("/files/rename", {
      oldPath: "old-name.mkv",
      newPath: "/work/new-name.mkv",
    })
    const body = await response.json() as { ok: boolean; error: string | null }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/absolute/i)
    const stillThere = await stat("/work/old-name.mkv")
    expect(stillThere.isFile()).toBe(true)
  })

  test("rejects relative newPath with a path-safety error", async () => {
    const response = await post("/files/rename", {
      oldPath: "/work/old-name.mkv",
      newPath: "new-name.mkv",
    })
    const body = await response.json() as { ok: boolean; error: string | null }

    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/absolute/i)
  })

  test("rejects an empty newPath via path validation", async () => {
    const response = await post("/files/rename", {
      oldPath: "/work/old-name.mkv",
      newPath: "",
    })
    const body = await response.json() as { ok: boolean; error: string | null }

    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/required|empty|absolute/i)
  })

  test("refuses to overwrite an existing destination file", async () => {
    const response = await post("/files/rename", {
      oldPath: "/work/old-name.mkv",
      newPath: "/work/sibling.mkv",
    })
    const body = await response.json() as { ok: boolean; error: string | null }

    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/already exists/i)
    // Original is preserved — the rename never fired.
    const original = await stat("/work/old-name.mkv")
    expect(original.isFile()).toBe(true)
  })

  test("returns ok: false with an ENOENT-shaped message when the source file does not exist", async () => {
    const response = await post("/files/rename", {
      oldPath: "/work/missing.mkv",
      newPath: "/work/whatever.mkv",
    })
    const body = await response.json() as { ok: boolean; error: string | null }

    expect(body.ok).toBe(false)
    expect(body.error).toBeTruthy()
  })

  test("rejects a missing oldPath / newPath via Zod validation (400)", async () => {
    const response = await post("/files/rename", { oldPath: "/work/old.mkv" })
    expect(response.status).toBe(400)
  })
})
