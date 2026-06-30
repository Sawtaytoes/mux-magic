import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  deleteFiles,
  getDeleteMode,
} from "./deleteFiles.js"

// Mock the `trash` package so trash-mode tests don't shell out to
// Shell.Application / gio trash. The mock records calls so tests can
// assert which paths went through trash vs a permanent delete, and
// removes the entry from memfs (recursively, so a directory works too)
// so callers see consistent state after delete.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push([...paths])
    paths.forEach((path) => {
      vol.rmSync(path, { recursive: true, force: true })
    })
    return Promise.resolve()
  }),
}))

describe(getDeleteMode.name, () => {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.DELETE_MODE
  })
  afterEach(() => {
    if (original === undefined)
      delete process.env.DELETE_MODE
    else process.env.DELETE_MODE = original
  })

  test("defaults to 'trash' when DELETE_MODE is unset", () => {
    delete process.env.DELETE_MODE
    expect(getDeleteMode()).toBe("trash")
  })

  test("'permanent' when DELETE_MODE=permanent", () => {
    process.env.DELETE_MODE = "permanent"
    expect(getDeleteMode()).toBe("permanent")
  })

  test("'trash' when DELETE_MODE=trash", () => {
    process.env.DELETE_MODE = "trash"
    expect(getDeleteMode()).toBe("trash")
  })

  test("trim + case-insensitive (Permanent -> permanent)", () => {
    process.env.DELETE_MODE = "  Permanent  "
    expect(getDeleteMode()).toBe("permanent")
  })

  test("falls back to 'trash' for an unrecognized value", () => {
    process.env.DELETE_MODE = "yes-please"
    expect(getDeleteMode()).toBe("trash")
  })
})

describe(deleteFiles.name, () => {
  beforeEach(() => {
    trashCalls.length = 0
    vol.fromJSON({
      "/disc-rips/SOLDIER/a.mkv": "a",
      "/disc-rips/SOLDIER/b.mkv": "b",
    })
  })

  afterEach(() => {
    delete process.env.DELETE_MODE
  })

  test("trash mode routes through the trash package and reports per-path success", async () => {
    process.env.DELETE_MODE = "trash"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv",
      "/disc-rips/SOLDIER/b.mkv",
    ])
    expect(results.every((res) => res.isOk)).toBe(true)
    // network-drive detection is no-op on non-Windows runners; on
    // Windows it consults a cached PowerShell call, which won't include
    // the memfs G: drive (it's a fake), so the call falls through to
    // trash mode either way.
    expect(
      results.every(
        (res) =>
          res.mode === "trash" || res.mode === "permanent",
      ),
    ).toBe(true)
  })

  test("permanent mode uses fs.rm and removes the file from disk", async () => {
    process.env.DELETE_MODE = "permanent"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv",
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[0].mode).toBe("permanent")
    expect(trashCalls).toHaveLength(0)
    expect(() =>
      vol.statSync("/disc-rips/SOLDIER/a.mkv"),
    ).toThrow()
  })

  test("permanent mode recursively removes a selected directory", async () => {
    process.env.DELETE_MODE = "permanent"
    // The SOLDIER dir from beforeEach still holds a.mkv + b.mkv, so this
    // also proves the recursive flag clears a non-empty directory.
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER",
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[0].mode).toBe("permanent")
    expect(trashCalls).toHaveLength(0)
    expect(() =>
      vol.statSync("/disc-rips/SOLDIER"),
    ).toThrow()
  })

  test("rejects relative paths without aborting the batch", async () => {
    process.env.DELETE_MODE = "permanent"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv", // valid
      "relative/path.mkv", // relative — rejected
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[1].isOk).toBe(false)
    expect(results[1].error).toMatch(/must be absolute/)
  })
})
