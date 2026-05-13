import { readFileSync, writeFileSync } from "node:fs"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { WEB_PORT } from "@mux-magic/server/src/tools/envVars.js"
import { logInfo } from "@mux-magic/tools/src/logMessage.js"
import { Hono } from "hono"

// If REMOTE_SERVER_URL is set, inject window.__API_BASE__ into the built
// index.html once at startup so the frontend reads the correct API base URL
// at runtime — no rebuild required. Writing to disk lets serveStatic serve
// the modified file directly for all routes.
if (process.env.REMOTE_SERVER_URL) {
  try {
    const raw = readFileSync("./dist/index.html", "utf8")
    const injected = raw.replace(
      "</head>",
      `<script>window.__API_BASE__=${JSON.stringify(process.env.REMOTE_SERVER_URL)}</script></head>`,
    )
    writeFileSync("./dist/index.html", injected, "utf8")
  } catch {
    // dist/index.html not present (e.g. before first build) — skip injection.
  }
}

export const app = new Hono()

// Serve all static assets and SPA routes from ./dist. Non-file paths (no
// extension) are rewritten to /index.html so the SPA handles client-side
// routing. Cache headers prevent stale assets after a redeployment.
app.use(
  "*",
  serveStatic({
    root: "./dist",
    rewriteRequestPath: (path) => {
      if (/\.[^/]+$/.test(path)) return path
      return "/index.html"
    },
    onFound: (_path, ctx) => {
      ctx.header(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      )
      ctx.header("Pragma", "no-cache")
    },
  }),
)

serve(
  {
    fetch: app.fetch,
    port: WEB_PORT,
  },
  () => {
    logInfo("WEB SERVER LISTENING PORT", WEB_PORT)
  },
)
