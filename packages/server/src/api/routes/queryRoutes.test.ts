import { sep as nativePathSeparator } from "node:path"
import { captureConsoleMessage } from "@mux-magic/tools"
import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"
import { queryRoutes } from "./queryRoutes.js"

// Hono in-process tests for the query routes that have no external
// dependencies (filesystem-only). Routes that hit MAL / TVDB / DVDCompare
// are out of scope here — they belong in their own tests with the
// network stubbed via vi.spyOn(globalThis, 'fetch') or msw.

const post = (path: string, body: unknown) =>
  queryRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /queries/listDirectoryEntries", () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/Movies/inception.mkv": "",
      "/work/Movies/the-matrix.mkv": "",
      "/work/TV/breaking-bad/s01e01.mkv": "",
      "/work/notes.txt": "",
    })
  })

  afterEach(() => {
    vol.reset()
  })

  test("returns the entries of a directory with directory flags", async () => {
    const response = await post(
      "/queries/listDirectoryEntries",
      { path: "/work" },
    )
    const body = (await response.json()) as {
      entries: Array<{ name: string; isDirectory: boolean }>
      error: string | null
    }

    const expected = [
      { name: "Movies", isDirectory: true },
      { name: "TV", isDirectory: true },
      { name: "notes.txt", isDirectory: false },
    ]
    expect(response.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.entries).toEqual(
      expect.arrayContaining(expected),
    )
    expect(body.entries).toHaveLength(expected.length)
  })

  test("includes the OS-native separator so the client can join paths correctly", async () => {
    const response = await post(
      "/queries/listDirectoryEntries",
      { path: "/work" },
    )
    const body = (await response.json()) as {
      separator: string
    }

    expect(body.separator).toBe(nativePathSeparator)
  })

  test("falls back to listing the parent when the given path is a file", async () => {
    const response = await post(
      "/queries/listDirectoryEntries",
      { path: "/work/notes.txt" },
    )
    const body = (await response.json()) as {
      entries: Array<{ name: string }>
    }

    expect(
      body.entries.map((entry) => entry.name).sort(),
    ).toEqual(["Movies", "TV", "notes.txt"].sort())
  })

  test("surfaces missing-path errors as a 200 with error: <message>", async () =>
    captureConsoleMessage("error", async () => {
      // Use a doubly-missing path so the dirname() fallback also misses — that
      // way readdir actually throws and the route's error envelope kicks in.
      const response = await post(
        "/queries/listDirectoryEntries",
        { path: "/missing-parent/missing-child" },
      )
      const body = (await response.json()) as {
        entries: Array<unknown>
        error: string | null
      }

      // The endpoint never 500s on filesystem errors — it packages them into
      // the response body so the client can render them inline.
      expect(response.status).toBe(200)
      expect(body.entries).toEqual([])
      expect(body.error).toMatch(/ENOENT|no such file/i)
    }))

  test("rejects requests with a missing 'path' field via Zod validation", async () => {
    const response = await post(
      "/queries/listDirectoryEntries",
      {},
    )
    expect(response.status).toBe(400)
  })
})
