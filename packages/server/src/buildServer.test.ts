import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brotliCompressSync } from "node:zlib"
import { describe, expect, test } from "vitest"
import { buildServer } from "./buildServer.js"

const createDistFixture = (): string => {
  const root = mkdtempSync(
    join(tmpdir(), "mux-magic-server-test-"),
  )
  mkdirSync(join(root, "web", "assets"), {
    recursive: true,
  })
  writeFileSync(
    join(root, "web", "index.html"),
    "<!doctype html><html><body>spa</body></html>",
  )
  writeFileSync(
    join(root, "web", "static.js"),
    "globalThis.staticAsset = true",
  )

  // A content-hashed bundle plus the `.br` sibling that
  // `precompressAssets()` writes at build time, so the cache bucket
  // and the encoding negotiation are both exercised.
  const bundle = "globalThis.bundle = true"
  writeFileSync(
    join(root, "web", "assets", "index-D7e1J0tu.js"),
    bundle,
  )
  writeFileSync(
    join(root, "web", "assets", "index-D7e1J0tu.js.br"),
    brotliCompressSync(Buffer.from(bundle)),
  )
  return root
}

describe("buildServer (prod mode)", () => {
  test("mounts the API sub-app under /api", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
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
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/not-a-real-file.png"),
    )
    expect(response.status).toBe(404)
  })

  // The SPA shell keeps its name across deploys, so it must be
  // revalidated — but `no-cache` (revalidate before reuse), not the
  // `no-store` this used to send. With the ETag below, the usual
  // answer is a 304 with no body instead of a re-download.
  test("the SPA shell revalidates rather than refusing to cache", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/"),
    )
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache",
    )
    expect(response.headers.get("ETag")).toBeTruthy()
  })

  // The regression that started this: `no-store` on a content-hashed
  // filename re-downloaded the whole bundle on every page load.
  test("content-hashed assets are cached forever", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request(
        "http://localhost/assets/index-D7e1J0tu.js",
      ),
    )
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    )
  })

  test("serves the precompressed sibling when accepted", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request(
        "http://localhost/assets/index-D7e1J0tu.js",
        { headers: { "Accept-Encoding": "br" } },
      ),
    )
    expect(response.headers.get("Content-Encoding")).toBe(
      "br",
    )
    expect(response.headers.get("Vary")).toContain(
      "Accept-Encoding",
    )
  })

  // `command-descriptions.js` ships unhashed from `public/`, so it
  // must not land in the immutable bucket with the hashed chunks.
  test("unhashed root files revalidate", async () => {
    const fixtureRoot = createDistFixture()
    const root = await buildServer({
      mode: "production",
      webDistDir: join(fixtureRoot, "web"),
    })
    const response = await root.fetch(
      new Request("http://localhost/static.js"),
    )
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache",
    )
  })
})
