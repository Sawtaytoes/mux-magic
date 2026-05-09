import { describe, expect, test } from "vitest"

import { fileRoutes } from "../api/routes/fileRoutes.js"
import { queryRoutes } from "../api/routes/queryRoutes.js"

const post = (routes: typeof queryRoutes, path: string, body: unknown) => (
  routes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
)

describe("?fake=1 query-toggle on read-only routes", () => {
  test("GET /files/list?fake=1 returns the canned listing", async () => {
    // No `path` query — would fail validation in the real handler, but
    // the fake path runs before validation since the fake handler does
    // not need any params.
    const response = await fileRoutes.request("/files/list?path=/dummy&fake=1")
    expect(response.status).toBe(200)
    const body = await response.json() as { entries: Array<{ name: string }> }
    expect(body.entries.length).toBeGreaterThan(0)
    expect(body.entries.some((e) => e.name === "Anime")).toBe(true)
  })

  test("GET /files/default-path?fake=1 returns the canned home dir", async () => {
    const response = await fileRoutes.request("/files/default-path?fake=1")
    expect(response.status).toBe(200)
    const body = await response.json() as { path: string }
    expect(body.path).toBe("/fake/home")
  })

  test("POST /queries/searchMal?fake=1 returns canned MAL results without hitting the network", async () => {
    const response = await post(queryRoutes, "/queries/searchMal?fake=1", { searchTerm: "anything" })
    expect(response.status).toBe(200)
    const body = await response.json() as { results: Array<{ name: string }> }
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results[0].name).toMatch(/Cowboy Bebop|Fullmetal|Steins/)
  })

  test("POST /queries/listDirectoryEntries?fake=1 returns canned directory entries", async () => {
    const response = await post(queryRoutes, "/queries/listDirectoryEntries?fake=1", { path: "/anything" })
    expect(response.status).toBe(200)
    const body = await response.json() as { entries: Array<{ name: string }>, separator: string }
    expect(body.entries.length).toBeGreaterThan(0)
    expect(body.separator).toBe("/")
  })
})

