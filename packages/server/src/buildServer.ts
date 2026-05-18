import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, sep } from "node:path"
import { app as apiApp } from "@mux-magic/api/src/api/hono-routes.js"
import { Hono } from "hono"

interface BuildServerOptions {
  mode: "development" | "production"
  webDistDir: string
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

// Returns the assembled Hono root.
//
// In production: /api/* and /* (SPA from packages/web/dist/) are
// registered. The result is callable directly: `root.fetch(req)`.
//
// In development: /api/* is registered, /* is left for the caller —
// `wireViteMiddleware` adds it so Vite can serve the SPA in middleware
// mode with HMR over the same port.
//
// Storybook is no longer handled here; run it separately via
// `yarn workspace @mux-magic/web storybook` (default port 6006).
export const buildServer = async (
  options: BuildServerOptions,
): Promise<Hono> => {
  const root = new Hono()

  // 1. /api/* — API sub-app mounted in-process. No proxy.
  root.route("/api", apiApp)

  // 2. /* — SPA. Dev mode defers to Vite (caller wires it later).
  if (options.mode === "production") {
    root.use("*", async (context) => {
      const requestUrl = new URL(context.req.url)
      const path = requestUrl.pathname
      const target = HAS_EXTENSION_REGEX.test(path)
        ? path
        : "/index.html"
      const body = await readStaticFile({
        rootDir: options.webDistDir,
        relativePath: target,
      })
      if (!body) {
        return context.notFound()
      }
      return serveFile({
        body,
        filePath: target,
      })
    })
  }

  return root
}
