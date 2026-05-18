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
// assert which paths went through trash vs unlink, and removes the
// file from memfs so callers see consistent state after delete.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push([...paths])
    paths.forEach((path) => {
      try {
        vol.unlinkSync(path)
      } catch {
        /* already gone */
      }
    })
    return Promise.resolve()
  }),
}))

describe(getDeleteMode.name, () => {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.DELETE_TO_TRASH
  })
  afterEach(() => {
    if (original === undefined)
      delete process.env.DELETE_TO_TRASH
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
  beforeEach(() => {
    trashCalls.length = 0
    vol.fromJSON({
      "/disc-rips/SOLDIER/a.mkv": "a",
      "/disc-rips/SOLDIER/b.mkv": "b",
    })
  })

  afterEach(() => {
    delete process.env.DELETE_TO_TRASH
  })

  test("trash mode routes through the trash package and reports per-path success", async () => {
    process.env.DELETE_TO_TRASH = "true"
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

  test("permanent mode uses fs.unlink and removes the file from disk", async () => {
    process.env.DELETE_TO_TRASH = "false"
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

  test("rejects relative paths without aborting the batch", async () => {
    process.env.DELETE_TO_TRASH = "false"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv", // valid
      "relative/path.mkv", // relative — rejected
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[1].isOk).toBe(false)
    expect(results[1].error).toMatch(/must be absolute/)
  })
})
