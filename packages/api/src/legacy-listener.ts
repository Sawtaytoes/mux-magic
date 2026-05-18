// LEGACY LISTENER BRIDGE
// ──────────────────────
// Temporary listener bridge between worker 2d (the core+api split) and
// worker 29 (single-port front-door at packages/server/). Worker 29
// introduces a new packages/server/ that owns the `serve()` call and
// deletes this file. Do not extend this file — any new listener-side
// concerns belong in worker 29's new packages/server/src/index.ts.
//
// `@mux-magic/api` exports the `app` Hono instance (see ./api/hono-routes.ts);
// that is the supported entry point. This file exists only so prod
// builds remain runnable between 2d and 29.

import "./loadEnv.js"
// Banner first — see `logBuildBanner.ts` for why this is a
// side-effect-only import at the top of the file.
import "./logBuildBanner.js"

import { serve } from "@hono/node-server"
import { resumePendingDeliveries } from "@mux-magic/core/src/api/jobErrorDeliveryQueue.js"
import { loadJobErrorsFromDisk } from "@mux-magic/core/src/api/jobErrorStore.js"
import {
  getActiveJobId,
  installLogBridge,
  installLogCapture,
} from "@mux-magic/core/src/api/logCapture.js"
import {
  API_PORT,
  MAX_THREADS,
} from "@mux-magic/core/src/tools/envVars.js"
import { reportProcessCrashed } from "@mux-magic/core/src/tools/webhookReporter.js"
import {
  initTaskScheduler,
  logError,
  logInfo,
  setLoggingMode,
} from "@mux-magic/tools"
import { app } from "./api/hono-routes.js"

// Node's docs are explicit: after `uncaughtException` the process is in
// undefined state and MUST exit. We fire one best-effort webhook (capped
// inside `reportProcessCrashed` so a dead receiver can't extend the
// restart) and then `process.exit(1)` so the supervisor (docker, pm2,
// systemd) brings up a fresh process. The `isExiting` latch guards
// against a second crash inside the handler itself looping back through.
const installCrashHandlers = (): void => {
  let isExiting = false
  const handle = (
    source: "uncaughtException" | "unhandledRejection",
    raw: unknown,
  ): void => {
    if (isExiting) return
    isExiting = true
    const err =
      raw instanceof Error ? raw : new Error(String(raw))
    logError("CRASH", `${source}: ${err.message}`)
    void reportProcessCrashed({
      reason: err.message,
      source,
      stack: err.stack ?? null,
    }).finally(() => {
      process.exit(1)
    })
  }
  process.on("uncaughtException", (err) =>
    handle("uncaughtException", err),
  )
  process.on("unhandledRejection", (reason) =>
    handle("unhandledRejection", reason),
  )
}

installCrashHandlers()
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
