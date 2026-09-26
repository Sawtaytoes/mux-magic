// Vite server middleware that handles all mock API routes for Storybook
// stories. Replaces the MSW browser Service Worker — the browser (Chromium)
// makes requests to the Vite dev server, so a configureServer middleware
// is the right interception point. No SW registration, no 350ms first-story
// overhead per test file.
//
// The routes themselves live in `mockRoutes.ts`, which a built Storybook
// answers from inside the page instead (`staticMockFetch.ts`).

import type {
  IncomingMessage,
  ServerResponse,
} from "node:http"
import type { Plugin } from "vite"
import {
  findMockRoute,
  toMockPathname,
} from "./mockRoutes.ts"

const sendJson = (
  res: ServerResponse,
  data: unknown,
  status = 200,
): void => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    "Content-Type": "application/json",
  })
  res.end(body)
}

// Tracks every open SSE response so Vitest can drain them on dev-server close.
// Without this, lingering keep-alive sockets prevent Vite's httpServer.close()
// from completing, and `yarn test` hangs after all suites finish.
const activeSseResponses = new Set<ServerResponse>()

// Keeps the SSE connection open and silent. The Jotai store in each story is
// pre-seeded, so no events need to arrive for the UI to render correctly. We
// MUST listen for the client disconnect and call res.end(), otherwise the Node
// HTTP server keeps the socket "active" and Vite's shutdown blocks.
const keepSseOpen = (
  req: IncomingMessage,
  res: ServerResponse,
): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  activeSseResponses.add(res)
  const cleanup = () => {
    activeSseResponses.delete(res)
    if (!res.writableEnded) res.end()
  }
  req.on("close", cleanup)
  res.on("close", cleanup)
}

// Reads the full request body as a UTF-8 string.
const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    )
    req.on("error", reject)
  })

// ── Plugin ─────────────────────────────────────────────────────────────────

export const mockServerPlugin = (): Plugin => ({
  name: "storybook-mock-server",
  configureServer(server) {
    // Force-end any SSE responses still open when Vite shuts down. Without
    // this, lingering keep-alive sockets block Vite's httpServer.close() and
    // `yarn test` hangs after every suite finishes.
    server.httpServer?.on("close", () => {
      for (const res of activeSseResponses) {
        if (!res.writableEnded) res.end()
      }
      activeSseResponses.clear()
    })
    server.middlewares.use(async (req, res, next) => {
      const match = findMockRoute({
        method: req.method ?? "GET",
        pathname: toMockPathname(req.url ?? "/"),
      })
      if (match === null) {
        next()
        return
      }
      try {
        const body =
          match.route.method === "POST"
            ? await readBody(req)
            : ""
        const reply = match.route.reply({
          body,
          params: match.params,
        })
        if (reply.kind === "eventStream") {
          keepSseOpen(req, res)
          return
        }
        sendJson(res, reply.body)
      } catch (err) {
        console.error(
          "[mock-server-plugin] handler error:",
          err,
        )
        if (!res.headersSent) {
          res.writeHead(500, {
            "Content-Type": "application/json",
          })
          res.end(JSON.stringify({ error: String(err) }))
        }
      }
    })
  },
})
