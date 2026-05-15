import "./loadEnv.js"
// Banner first — see `logBuildBanner.ts` for why this is a
// side-effect-only import at the top of the file (so `yarn api-server`
// gets the same boot banner as `yarn server` without going through
// `start-servers.ts`).
import "./logBuildBanner.js"

import { serve } from "@hono/node-server"
import {
  initTaskScheduler,
  logInfo,
  setLoggingMode,
} from "@mux-magic/tools"
import { app } from "./api/hono-routes.js"
import { resumePendingDeliveries } from "./api/jobErrorDeliveryQueue.js"
import { loadJobErrorsFromDisk } from "./api/jobErrorStore.js"
import {
  getActiveJobId,
  installLogBridge,
  installLogCapture,
} from "./api/logCapture.js"
import { API_PORT, MAX_THREADS } from "./tools/envVars.js"

installLogCapture()
installLogBridge()
// API mode: route `logInfo` / `logError` / `logWarning` through the
// structured logger (and thence through `installLogBridge`'s sink to
// appendJobLog) rather than to chalk-coloured console output. The web
// UI is the audience here, not a human terminal.
setLoggingMode("api")
initTaskScheduler(MAX_THREADS, { getActiveJobId })

serve(
  {
    fetch: app.fetch,
    port: API_PORT,
  },
  () => {
    logInfo("API SERVER LISTENING PORT", API_PORT)
    // Replay any persisted errors whose webhook delivery was still
    // `pending` when the previous process exited. Async + fire-and-
    // forget: the server is already accepting connections; we don't
    // block startup on disk I/O.
    loadJobErrorsFromDisk()
      .then(() => {
        resumePendingDeliveries()
      })
      .catch(() => undefined)
  },
)
