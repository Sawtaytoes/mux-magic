import "@mux-magic/api/src/loadEnv.js"
import "@mux-magic/api/src/logBuildBanner.js"

import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getRequestListener } from "@hono/node-server"
import { resumePendingDeliveries } from "@mux-magic/core/src/api/jobErrorDeliveryQueue.js"
import { loadJobErrorsFromDisk } from "@mux-magic/core/src/api/jobErrorStore.js"
import { pruneOldJobs } from "@mux-magic/core/src/api/jobPersistence.js"
import { seedJobsFromDisk } from "@mux-magic/core/src/api/jobStore.js"
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
import { buildServer } from "./buildServer.js"
import { wireViteMiddleware } from "./viteMiddleware.js"

const COMPLETED_JOB_RETENTION_DAYS = 7
const ONE_HOUR_MS = 60 * 60 * 1000

const startIntervalPrune = (): void => {
  setInterval(() => {
    pruneOldJobs({
      retentionDays: COMPLETED_JOB_RETENTION_DAYS,
    }).catch(() => undefined)
  }, ONE_HOUR_MS).unref()
}

// Mirrors the crash-handler / log-bridge bootstrap from the legacy
// listener (packages/api/src/legacy-listener.ts, deleted in this worker).
// Worker 29 collapses the two-process layout into this single front
// door; everything that used to live in the API's listener now lives
// here.
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

// Dev-only graceful shutdown so `node --watch-path` can restart cleanly
// without leaving port 3000 bound. The watcher sends SIGTERM to the old
// child, then immediately spawns the replacement — without
// `httpServer.close()` between them, the new child crashes on `listen()`
// with EADDRINUSE because the OS hasn't released the port yet.
//
// NOT installed in prod. Prod is run-once: any unhandled crash exits
// the process and Docker's restart policy takes over. No graceful-drain
// machinery wanted in that path.
const installDevShutdownHandlers = (
  httpServer: HttpServer,
): void => {
  let isShuttingDown = false
  const shutdown = (signal: "SIGTERM" | "SIGINT"): void => {
    if (isShuttingDown) return
    isShuttingDown = true
    logInfo("SHUTDOWN", signal)
    httpServer.close(() => {
      process.exit(0)
    })
    // Fallback in case close() hangs on a stuck connection.
    setTimeout(() => process.exit(0), 2000).unref()
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

const moduleDir = dirname(fileURLToPath(import.meta.url))

// Auto-detect prod when the bundle runs from packages/server/dist/.
// Dev path lives at packages/server/src/. This means cross-platform
// scripts don't need NODE_ENV=production-style shell prefixes which
// don't work on plain PowerShell.
const isBundleDist = moduleDir
  .replace(/\\/g, "/")
  .endsWith("/dist")

// Resolve static roots relative to the bundle, not cwd. The dev path
// imports from packages/server/src/, so `moduleDir` is
// `<repo>/packages/server/src`. The prod bundle lives at
// `<repo>/packages/server/dist/index.js`. Either way `../../web/...`
// lands on `<repo>/packages/web/...`.
const webPackageDir = resolve(moduleDir, "..", "..", "web")
const webDistDir = resolve(webPackageDir, "dist")

const isProduction =
  process.env.NODE_ENV === "production" || isBundleDist

const boot = async (): Promise<void> => {
  installCrashHandlers()
  installLogCapture()
  installLogBridge()
  setLoggingMode("api")
  initTaskScheduler(MAX_THREADS, { getActiveJobId })

  if (isProduction) {
    const root = await buildServer({
      mode: "production",
      webDistDir,
    })
    const httpServer = createHttpServer(
      getRequestListener(root.fetch),
    )
    httpServer.listen(API_PORT, () => {
      console.log(
        `Server listening on http://localhost:${API_PORT}`,
      )
      seedJobsFromDisk().catch(() => undefined)
      startIntervalPrune()
      loadJobErrorsFromDisk()
        .then(() => {
          resumePendingDeliveries()
        })
        .catch(() => undefined)
    })
    return
  }

  // ── Development ──
  // Storybook is NOT booted by the front-door anymore. Running both
  // Storybook (which spins up its own Vite instance) and the app's Vite
  // middleware in the same Node process caused two compounding issues:
  // (1) Storybook's preset-loader wrote temp files inside
  //     packages/web/node_modules/.vite-temp/, and `tsx watch` treated
  //     every unlink as a source change and restart-looped.
  // (2) Each restart re-evaluated the Hono module graph mid-flight, so
  //     the `root.route("/api", apiApp)` mount didn't always land in
  //     order before requests started arriving — symptom: apiApp's
  //     routes responded at `/` instead of `/api/`.
  //
  // Side-by-side fix: drop Storybook from the front-door's dev process
  // entirely. The API + SPA stay on a single port (worker 29's win).
  // Storybook runs separately via `yarn workspace @mux-magic/web
  // storybook` when needed, on its own port (default 6006).
  //
  // Boot sequence:
  // 1. Build the Hono root in dev mode (no /storybook routes registered).
  // 2. Create http server.
  // 3. Wire Vite middleware into the root for the SPA + HMR.
  // 4. Attach root.fetch as the request listener and start listening.
  const root = await buildServer({
    mode: "development",
    webDistDir,
  })

  const httpServer = createHttpServer()
  await wireViteMiddleware({
    httpServer,
    root,
    webRoot: webPackageDir,
  })

  httpServer.on("request", getRequestListener(root.fetch))
  installDevShutdownHandlers(httpServer)
  httpServer.listen(API_PORT, () => {
    console.log(
      `Dev server listening on http://localhost:${API_PORT}`,
    )
    seedJobsFromDisk().catch(() => undefined)
    startIntervalPrune()
    loadJobErrorsFromDisk()
      .then(() => {
        resumePendingDeliveries()
      })
      .catch(() => undefined)
  })
}

boot().catch((err) => {
  logError(
    "BOOT FAILED",
    err instanceof Error ? err.message : String(err),
  )
  process.exit(1)
})
