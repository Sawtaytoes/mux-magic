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

serve(
  {
    fetch: app.fetch,
    port: WEB_PORT,
  },
  () => {
    logInfo("WEB SERVER LISTENING PORT", WEB_PORT)
  },
)
