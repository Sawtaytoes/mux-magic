import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { buildServer } from "./buildServer.js"

const createDistFixture = (): string => {
  const root = mkdtempSync(
    join(tmpdir(), "mux-magic-server-test-"),
  )
  mkdirSync(join(root, "web"), { recursive: true })
  writeFileSync(
    join(root, "web", "index.html"),
    "<!doctype html><html><body>spa</body></html>",
  )
  writeFileSync(
    join(root, "web", "static.js"),
    "globalThis.staticAsset = true",
  )
  mkdirSync(join(root, "storybook"), { recursive: true })
  writeFileSync(
    join(root, "storybook", "index.html"),
    "<!doctype html><html><body>storybook</body></html>",
  )
  return root
}

describe("buildServer (prod mode)", () => {
  test("mounts the API sub-app under /api", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/api/version"),
    )
    expect(response.status).toBe(200)
  })

  test("serves the SPA index.html at /", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/"),
    )
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain("spa")
  })

  test("serves extension-less SPA fallback paths via index.html", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/some/spa/route"),
    )
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain("spa")
  })

  test("returns 404 for missing files with an extension", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/not-a-real-file.png"),
    )
    expect(response.status).toBe(404)
  })

  test("emits no-cache headers on SPA responses", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/"),
    )
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    )
    expect(response.headers.get("Pragma")).toBe("no-cache")
  })

  test("serves Storybook static assets under /storybook", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      storybookDistDir: join(fixtureRoot, "storybook"),
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/storybook/"),
    )
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain("storybook")
  })
})
