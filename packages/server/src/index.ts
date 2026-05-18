import "@mux-magic/api/src/loadEnv.js"
import "@mux-magic/api/src/logBuildBanner.js"

import { createServer as createHttpServer } from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getRequestListener } from "@hono/node-server"
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
import { buildServer } from "./buildServer.js"
import { startStorybookDev } from "./storybookDevProxy.js"
import { wireViteMiddleware } from "./viteMiddleware.js"

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

const moduleDir = dirname(fileURLToPath(import.meta.url))

// Auto-detect prod when the bundle runs from packages/server/dist/.
// Dev path lives at packages/server/src/. This means cross-platform
// scripts don't need NODE_ENV=production-style shell prefixes which
// don't work on plain PowerShell.
const isBundleDist = moduleDir.replace(/\\/g, "/").endsWith("/dist")

// Resolve static roots relative to the bundle, not cwd. The dev path
// imports from packages/server/src/, so `moduleDir` is
// `<repo>/packages/server/src`. The prod bundle lives at
// `<repo>/packages/server/dist/index.js`. Either way `../../web/...`
// lands on `<repo>/packages/web/...`.
const webPackageDir = resolve(moduleDir, "..", "..", "web")
const webDistDir = resolve(webPackageDir, "dist")
const storybookDistDir = resolve(webPackageDir, "storybook-static")

const isProduction =
  process.env.NODE_ENV === "production" || isBundleDist

const pickStorybookPort = (): number => {
  const fromEnv = Number(process.env.STORYBOOK_INTERNAL_PORT)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return 6006
}

const boot = async (): Promise<void> => {
  installCrashHandlers()
  installLogCapture()
  installLogBridge()
  setLoggingMode("api")
  initTaskScheduler(MAX_THREADS, { getActiveJobId })

  if (isProduction) {
    const root = await buildServer({
      mode: "production",
      storybookDistDir,
      webDistDir,
    })
    const httpServer = createHttpServer(
      getRequestListener(root.fetch),
    )
    httpServer.listen(API_PORT, () => {
      logInfo("MUX-MAGIC SERVER LISTENING PORT", API_PORT)
      loadJobErrorsFromDisk()
        .then(() => {
          resumePendingDeliveries()
        })
        .catch(() => undefined)
    })
    return
  }

  // ── Development ──
  // 1. Spawn Storybook on its internal port so the front-door can
  //    proxy /storybook/* to it.
  // 2. Build the Hono root in dev mode (no /* SPA branch — Vite owns it).
  // 3. Create http server BEFORE Vite so we can pass it to Vite as the
  //    HMR upgrade target. WebSocket upgrade rides the same port.
  // 4. Wire Vite middleware into the root.
  // 5. Attach root.fetch as the request listener and start listening.
  const storybookPort = pickStorybookPort()
  const storybookHandle = await startStorybookDev({
    port: storybookPort,
    webPackageDir,
  })
  const teardown = (): void => {
    storybookHandle.child.kill()
  }
  process.on("SIGTERM", teardown)
  process.on("SIGINT", teardown)

  const root = await buildServer({
    mode: "development",
    storybookDistDir,
    storybookProxyTarget: storybookHandle.url,
    webDistDir,
  })

  const httpServer = createHttpServer()
  await wireViteMiddleware({
    httpServer,
    root,
    webRoot: webPackageDir,
  })

  httpServer.on("request", getRequestListener(root.fetch))
  httpServer.listen(API_PORT, () => {
    logInfo("MUX-MAGIC DEV SERVER LISTENING PORT", API_PORT)
    logInfo("STORYBOOK INTERNAL PORT", storybookPort)
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
