import { readFileSync } from "node:fs"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { WEB_PORT } from "@media-tools/server/src/tools/envVars.js"
import { logInfo } from "@media-tools/server/src/tools/logMessage"
import { Hono } from "hono"

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
app.get("*", (context) => {
  if (/\.[^/]+$/.test(context.req.path)) {
    return context.notFound()
  }
  try {
    const html = readFileSync("./dist/index.html", "utf8")
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
