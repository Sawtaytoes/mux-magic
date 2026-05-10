// Banner first — see `logBuildBanner.ts` for why this is a
// side-effect-only import at the top of the file (so `yarn api-server`
// gets the same boot banner as `yarn server` without going through
// `start-servers.ts`).
import "./logBuildBanner.js"

import { serve } from "@hono/node-server"

import { app } from "./api/hono-routes.js"
import { installLogCapture } from "./api/logCapture.js"
import { logInfo } from "./tools/logMessage.js"
import { MAX_THREADS, PORT } from "./tools/port.js"
import { initTaskScheduler } from "./tools/taskScheduler.js"

installLogCapture()
initTaskScheduler(MAX_THREADS)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    logInfo("API SERVER LISTENING PORT", PORT)
  },
)
