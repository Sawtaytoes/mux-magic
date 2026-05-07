import { vol } from "memfs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { deleteFiles, getDeleteMode } from "./deleteFiles.js"

// Mock the `trash` package so trash-mode tests don't actually shell out
// to Shell.Application / gio trash. The mock records calls so the tests
// can assert which paths went through trash vs unlink.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push([...paths])
    // memfs-driven tests need the file to actually disappear so callers
    // see consistent state after delete; mimic by removing via vol.
    paths.forEach((p) => {
      try { vol.unlinkSync(p) } catch { /* already gone */ }
    })
    return Promise.resolve()
  }),
}))

describe(getDeleteMode.name, () => {
  let original: string | undefined
  beforeEach(() => { original = process.env.DELETE_TO_TRASH })
  afterEach(() => {
    if (original === undefined) delete process.env.DELETE_TO_TRASH
    else process.env.DELETE_TO_TRASH = original
  })

  test("defaults to 'trash' when env is unset", () => {
    delete process.env.DELETE_TO_TRASH
    expect(getDeleteMode()).toBe("trash")
  })

  test("'permanent' when DELETE_TO_TRASH=false", () => {
    process.env.DELETE_TO_TRASH = "false"
    expect(getDeleteMode()).toBe("permanent")
  })

  test("'permanent' when DELETE_TO_TRASH=0", () => {
    process.env.DELETE_TO_TRASH = "0"
    expect(getDeleteMode()).toBe("permanent")
  })

  test("'trash' when DELETE_TO_TRASH=true", () => {
    process.env.DELETE_TO_TRASH = "true"
    expect(getDeleteMode()).toBe("trash")
  })
})

describe(deleteFiles.name, () => {
  // Use a Windows-style root since the rest of the codebase tests
  // already model that and the path-safety guard is platform-agnostic.
  const allowedRoot = "G:\\Disc-Rips"

  beforeEach(() => {
    trashCalls.length = 0
    process.env.ALLOWED_DELETE_ROOTS = allowedRoot
    vol.fromJSON({
      "G:\\Disc-Rips\\SOLDIER\\a.mkv": "a",
      "G:\\Disc-Rips\\SOLDIER\\b.mkv": "b",
      "G:\\Other\\unrelated.mkv": "x",
    })
  })

  afterEach(() => {
    delete process.env.ALLOWED_DELETE_ROOTS
    delete process.env.DELETE_TO_TRASH
  })

  test("trash mode routes through the trash package and reports per-path success", async () => {
    process.env.DELETE_TO_TRASH = "true"
    const { mode, results } = await deleteFiles([
      "G:\\Disc-Rips\\SOLDIER\\a.mkv",
      "G:\\Disc-Rips\\SOLDIER\\b.mkv",
    ])
    expect(mode).toBe("trash")
    expect(results.every((r) => r.ok)).toBe(true)
    expect(trashCalls).toHaveLength(2)
  })

  test("permanent mode uses fs.unlink and removes the file from disk", async () => {
    process.env.DELETE_TO_TRASH = "false"
    const { mode, results } = await deleteFiles([
      "G:\\Disc-Rips\\SOLDIER\\a.mkv",
    ])
    expect(mode).toBe("permanent")
    expect(results[0].ok).toBe(true)
    expect(trashCalls).toHaveLength(0)
    // File is gone from the in-memory FS
    expect(() => vol.statSync("G:\\Disc-Rips\\SOLDIER\\a.mkv")).toThrow()
  })

  test("rejects paths outside ALLOWED_DELETE_ROOTS without aborting the batch", async () => {
    process.env.DELETE_TO_TRASH = "false"
    const { results } = await deleteFiles([
      "G:\\Disc-Rips\\SOLDIER\\a.mkv",   // allowed
      "G:\\Other\\unrelated.mkv",         // outside roots
    ])
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toMatch(/outside the configured/)
    // Allowed file is gone, disallowed file is preserved
    expect(() => vol.statSync("G:\\Disc-Rips\\SOLDIER\\a.mkv")).toThrow()
    expect(vol.statSync("G:\\Other\\unrelated.mkv")).toBeDefined()
  })

  test("fails closed when ALLOWED_DELETE_ROOTS is unset", async () => {
    delete process.env.ALLOWED_DELETE_ROOTS
    const { results } = await deleteFiles(["G:\\Disc-Rips\\SOLDIER\\a.mkv"])
    expect(results[0].ok).toBe(false)
    expect(results[0].error).toMatch(/Deletes are disabled/)
  })

  test("rejects relative paths", async () => {
    const { results } = await deleteFiles(["relative/path.mkv"])
    expect(results[0].ok).toBe(false)
    expect(results[0].error).toMatch(/must be absolute/)
  })
})
