import { readFileSync } from "node:fs"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { WEB_PORT } from "@media-tools/server/src/tools/envVars.js"
import { logInfo } from "@media-tools/server/src/tools/logMessage.js"
import { Hono } from "hono"

// Read once at startup — REMOTE_SERVER_URL is static for the lifetime of the process.
const remoteServerUrl = process.env.REMOTE_SERVER_URL ?? ""

export const app = new Hono()

app.use(
  "*",
  serveStatic({
    root: "./dist",
    onFound: (_path, ctx) => {
      // Prevent browsers from caching static assets so JS/HTML changes are
      // always reflected immediately without a hard refresh.
      ctx.header(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      )
      ctx.header("Pragma", "no-cache")
    },
  }),
)

// SPA fallback: serve index.html for routes serveStatic didn't match.
// Scoped to extension-free paths so asset 404s (e.g. a missing .js chunk)
// are not silently swallowed — React Router owns all non-dot paths.
// Read per-request so a rebuild+server-restart picks up the new asset hashes.
// Injects window.__API_BASE__ so the frontend can reach the API server at
// runtime without a rebuild (set via REMOTE_SERVER_URL env var).
app.get("*", (context) => {
  if (/\.[^/]+$/.test(context.req.path)) {
    return context.notFound()
  }
  try {
    const raw = readFileSync("./dist/index.html", "utf8")
    const html = remoteServerUrl
      ? raw.replace(
          "</head>",
          `<script>window.__API_BASE__=${JSON.stringify(remoteServerUrl)}</script></head>`,
        )
      : raw
    return context.html(html)
  } catch {
    return context.notFound()
  }
})

serve(
  {
    fetch: app.fetch,
    port: WEB_PORT,
  },
  () => {
    logInfo("WEB SERVER LISTENING PORT", WEB_PORT)
  },
)
