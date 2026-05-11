// Vite server middleware that handles all mock API routes for Storybook
// stories. Replaces the MSW browser Service Worker — the browser (Chromium)
// makes requests to the Vite dev server, so a configureServer middleware
// is the right interception point. No SW registration, no 350ms first-story
// overhead per test file.
//
// To add a new mock route, add an entry to `routes` below. Routes are
// matched top-to-bottom; the first match wins.

import type {
  IncomingMessage,
  ServerResponse,
} from "node:http"
import type { Plugin } from "vite"

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>

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

// Keeps the SSE connection open and silent. The Jotai store in each story is
// pre-seeded, so no events need to arrive for the UI to render correctly.
const keepSseOpen = (res: ServerResponse): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  // Don't call res.end() — let the EventSource connection stay open until the
  // browser closes it when the test frame is torn down.
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

// Matches a path pattern like "/jobs/:jobId/logs" against a request URL,
// returning captured params or null on no-match. Query strings are ignored.
const matchPath = (
  pattern: string,
  rawUrl: string,
): Record<string, string> | null => {
  const pathname = rawUrl.split("?")[0]
  const pp = pattern.split("/")
  const up = pathname.split("/")
  if (pp.length !== up.length) return null
  const params: Record<string, string> = {}
  for (let idx = 0; idx < pp.length; idx++) {
    if (pp[idx].startsWith(":")) {
      params[pp[idx].slice(1)] = up[idx]
    } else if (pp[idx] !== up[idx]) {
      return null
    }
  }
  return params
}

interface Route {
  method: string
  path: string
  handler: RouteHandler
}

// ── Mock routes ────────────────────────────────────────────────────────────
// Add new entries here whenever a story makes a fetch or EventSource request.

const routes: Route[] = [
  {
    method: "GET",
    path: "/version",
    handler: (_, res) => {
      sendJson(res, { isContainerized: false })
    },
  },
  {
    method: "GET",
    path: "/files/delete-mode",
    handler: (_, res) => {
      sendJson(res, { mode: "trash" })
    },
  },
  {
    method: "GET",
    path: "/files/list",
    handler: (_, res) => {
      sendJson(res, {
        separator: "/",
        entries: [
          {
            name: "Sample Folder",
            isDirectory: true,
            isFile: false,
            size: 0,
            mtime: null,
            duration: null,
          },
          {
            name: "sample.mp4",
            isDirectory: false,
            isFile: true,
            size: 524_288_000,
            mtime: "2025-01-15T10:30:00Z",
            duration: "1:23:45",
          },
          {
            name: "document.txt",
            isDirectory: false,
            isFile: true,
            size: 2048,
            mtime: "2025-01-10T14:20:00Z",
            duration: null,
          },
        ],
      })
    },
  },
  {
    method: "GET",
    path: "/jobs/stream",
    handler: (_, res) => keepSseOpen(res),
  },
  {
    method: "GET",
    path: "/jobs/:jobId/logs",
    handler: (_, res) => keepSseOpen(res),
  },
  // ── Lookup search endpoints (used by LookupModal stories) ───────────────────
  {
    method: "POST",
    path: "/queries/searchDvdCompare",
    handler: (_, res) => {
      sendJson(res, {
        results: [
          {
            baseTitle: "Neon Genesis Evangelion",
            year: "1995",
            variants: [
              { id: "fid-1", variant: "Blu-ray 4K" },
              { id: "fid-2", variant: "Blu-ray" },
              { id: "fid-3", variant: "DVD" },
            ],
          },
          {
            baseTitle:
              "Evangelion: 1.11 You Are (Not) Alone",
            year: "2007",
            variants: [{ id: "fid-4", variant: "Blu-ray" }],
          },
        ],
      })
    },
  },
  {
    method: "POST",
    path: "/queries/listDvdCompareReleases",
    handler: (_, res) => {
      sendJson(res, {
        releases: [
          {
            id: "rel-1",
            label: "Discotek Media (US) 2023",
            region: "A",
            format: "Blu-ray 4K",
          },
          {
            id: "rel-2",
            label: "Funimation (US) 2019",
            region: "A",
            format: "Blu-ray",
          },
        ],
        debug: null,
      })
    },
  },
  {
    method: "POST",
    path: "/queries/searchMal",
    handler: (_, res) => {
      sendJson(res, {
        results: [
          { malId: 30, name: "Neon Genesis Evangelion" },
          { malId: 32, name: "End of Evangelion" },
        ],
      })
    },
  },
  {
    method: "POST",
    path: "/queries/searchAnidb",
    handler: (_, res) => {
      sendJson(res, {
        results: [
          { aid: 38, name: "Shinseiki Evangelion" },
        ],
      })
    },
  },
  {
    method: "POST",
    path: "/queries/searchTvdb",
    handler: (_, res) => {
      sendJson(res, {
        results: [
          {
            tvdbId: 73752,
            name: "Neon Genesis Evangelion",
          },
        ],
      })
    },
  },
  {
    method: "POST",
    path: "/queries/searchMovieDb",
    handler: (_, res) => {
      sendJson(res, {
        results: [
          {
            movieDbId: 18491,
            title:
              "Neon Genesis Evangelion: The End of Evangelion",
            year: "1997",
          },
        ],
      })
    },
  },
  // ── File system endpoints ────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/files/default-path",
    handler: (_, res) => {
      sendJson(res, { path: "/media" })
    },
  },
  {
    method: "POST",
    path: "/queries/listDirectoryEntries",
    handler: async (req, res) => {
      const raw = await readBody(req)
      const body = JSON.parse(raw) as { path?: string }
      if (
        typeof body.path === "string" &&
        body.path.startsWith("/nonexistent")
      ) {
        sendJson(res, {
          error: `Directory not found: ${body.path}`,
        })
        return
      }
      sendJson(res, {
        separator: "/",
        entries: [
          { name: "Documents", isDirectory: true },
          { name: "Downloads", isDirectory: true },
          { name: "Music", isDirectory: true },
          { name: "Pictures", isDirectory: true },
          { name: "Videos", isDirectory: true },
        ],
      })
    },
  },
]

// ── Plugin ─────────────────────────────────────────────────────────────────

export const mockServerPlugin = (): Plugin => ({
  name: "storybook-mock-server",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const method = (req.method ?? "GET").toUpperCase()
      for (const route of routes) {
        if (route.method !== method) continue
        const params = matchPath(route.path, req.url ?? "/")
        if (params === null) continue
        try {
          await route.handler(req, res, params)
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
        return
      }
      next()
    })
  },
})
