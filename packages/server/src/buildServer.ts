import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, sep } from "node:path"
import type { Server } from "node:http"
import { app as apiApp } from "@mux-magic/api/src/api/hono-routes.js"
import { Hono } from "hono"

interface BuildServerOptions {
  mode: "development" | "production"
  webDistDir: string
  storybookDistDir: string
  storybookProxyTarget?: string
}

export interface BuildServerResult {
  fetch: (request: Request) => Promise<Response>
  attachUpgrade: (httpServer: Server) => void
}

const HAS_EXTENSION_REGEX = /\.[^/]+$/

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
} as const

const CONTENT_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
])

const getContentType = (filePath: string): string =>
  CONTENT_TYPES.get(extname(filePath).toLowerCase()) ??
  "application/octet-stream"

// Block path-traversal: after join+normalize the absolute file path must
// still live underneath the configured root directory.
const isWithinRoot = ({
  rootDir,
  candidate,
}: {
  rootDir: string
  candidate: string
}): boolean => {
  const normalizedRoot = normalize(rootDir + sep)
  const normalizedCandidate = normalize(candidate)
  return (
    normalizedCandidate === normalize(rootDir) ||
    normalizedCandidate.startsWith(normalizedRoot)
  )
}

const readStaticFile = async ({
  rootDir,
  relativePath,
}: {
  rootDir: string
  relativePath: string
}): Promise<Buffer | null> => {
  const trimmed = relativePath.replace(/^\/+/, "")
  const candidate = join(rootDir, trimmed)
  if (
    !isWithinRoot({
      rootDir,
      candidate,
    })
  ) {
    return null
  }
  try {
    const fileStat = await stat(candidate)
    if (!fileStat.isFile()) return null
    return await readFile(candidate)
  } catch {
    return null
  }
}

const serveFile = ({
  body,
  filePath,
}: {
  body: Buffer
  filePath: string
}): Response =>
  new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": getContentType(filePath),
      ...NO_CACHE_HEADERS,
    },
  })

export const buildServer = async (
  options: BuildServerOptions,
): Promise<BuildServerResult> => {
  const root = new Hono()

  // 1. /api/* — the API sub-app is mounted in-process; no proxy, no
  // second TCP listener. The api package owns its own CORS middleware.
  root.route("/api", apiApp)

  // 2. /storybook/* — proxy to a `storybook dev` child in development,
  // serveStatic of `packages/web/storybook-static/` in production.
  if (options.mode === "development" && options.storybookProxyTarget) {
    const proxyTarget = options.storybookProxyTarget.replace(
      /\/+$/,
      "",
    )
    root.all("/storybook/*", async (c) => {
      const requestUrl = new URL(c.req.url)
      const upstream = `${proxyTarget}${requestUrl.pathname}${requestUrl.search}`
      // Strip hop-by-hop headers that confuse upstreams.
      const forwardedHeaders = new Headers(c.req.raw.headers)
      forwardedHeaders.delete("host")
      forwardedHeaders.delete("connection")
      const body =
        c.req.method === "GET" || c.req.method === "HEAD"
          ? undefined
          : await c.req.raw.arrayBuffer()
      const upstreamResponse = await fetch(upstream, {
        body,
        headers: forwardedHeaders,
        method: c.req.method,
        redirect: "manual",
      })
      return new Response(upstreamResponse.body, {
        headers: upstreamResponse.headers,
        status: upstreamResponse.status,
      })
    })
  } else {
    root.get("/storybook", (c) => c.redirect("/storybook/"))
    root.get("/storybook/*", async (c) => {
      const requestUrl = new URL(c.req.url)
      const stripped =
        requestUrl.pathname.replace(/^\/storybook\/?/, "") || ""
      // /storybook/  → index.html
      // /storybook/foo.js → foo.js
      // /storybook/some/route (no extension) → index.html (storybook
      // is a multi-page static bundle whose index handles client-side
      // routing too).
      const target = HAS_EXTENSION_REGEX.test(stripped)
        ? stripped
        : "index.html"
      const body = await readStaticFile({
        rootDir: options.storybookDistDir,
        relativePath: target,
      })
      if (!body) {
        return c.notFound()
      }
      return serveFile({
        body,
        filePath: target,
      })
    })
  }

  // 3. /* — the SPA. In development, Vite middleware is wired up by the
  // entry-point (see `wireViteMiddleware` in src/viteMiddleware.ts). In
  // production we read straight from the SPA bundle on disk with a
  // standard extensionless-path → index.html fallback.
  if (options.mode === "production") {
    root.use("*", async (c) => {
      const requestUrl = new URL(c.req.url)
      const path = requestUrl.pathname
      const target = HAS_EXTENSION_REGEX.test(path)
        ? path
        : "/index.html"
      const body = await readStaticFile({
        rootDir: options.webDistDir,
        relativePath: target,
      })
      if (!body) {
        return c.notFound()
      }
      return serveFile({
        body,
        filePath: target,
      })
    })
  }

  return {
    fetch: async (request) => root.fetch(request),
    // Filled in by the entry point when dev Vite is wired up so HMR
    // WebSocket upgrades reach Vite's connect-style middleware chain.
    attachUpgrade: () => undefined,
  }
}
