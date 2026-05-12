import { readFileSync } from "node:fs"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { WEB_PORT } from "@media-tools/server/src/tools/envVars.js"
import { logInfo } from "@media-tools/server/src/tools/logMessage.js"
import { Hono } from "hono"

// Read once at startup — REMOTE_SERVER_URL is static for the lifetime of the process.
const remoteServerUrl = process.env.REMOTE_SERVER_URL ?? ""

export const app = new Hono()

// SPA routes (no file extension): inject window.__API_BASE__ and serve
// index.html. Must come BEFORE serveStatic so that the root path "/" is
// handled here rather than by serveStatic finding ./dist/index.html directly
// (which would skip injection). Extension paths fall through via next() so
// serveStatic can serve JS/CSS/font assets normally.
// Read per-request so a rebuild+server-restart picks up new asset hashes.
app.get("*", async (context, next) => {
  if (/\.[^/]+$/.test(context.req.path)) return next()
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

// Static assets (JS, CSS, fonts, etc.). Prevent caching so changes are
// picked up immediately without a hard refresh.
app.use(
  "*",
  serveStatic({
    root: "./dist",
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
