#!/usr/bin/env node
"use strict"

// Direct-spawn orchestrator used as the container CMD in place of
// `concurrently -k yarn prod:api-server yarn prod:web-server`. The yarn
// path forked Node 6+ times per side (yarn → corepack → yarn workspace →
// tsx) and pinned ~800 MB of process baseline at idle; here we exec node
// against the pre-built esbuild bundles and the container sees three
// processes total (this script + two servers).
//
// Forwards SIGINT/SIGTERM so `docker stop` propagates cleanly, and exits
// the whole script if either child dies — matches `concurrently -k`
// semantics so the supervisor restarts the container instead of leaving
// half a deployment running.

const { spawn } = require("node:child_process")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

const apiProc = spawn(
  process.execPath,
  [
    "--enable-source-maps",
    "packages/api/dist/legacy-listener.mjs",
  ],
  { cwd: repoRoot, stdio: "inherit" },
)

// The web mini-server reads `./dist/index.html` and serves `./dist`
// via cwd-relative paths, so spawn it with cwd at packages/web/ to
// avoid threading a config flag through just for this.
const webProc = spawn(
  process.execPath,
  ["--enable-source-maps", "dist-server/server.mjs"],
  {
    cwd: path.join(repoRoot, "packages/web"),
    stdio: "inherit",
  },
)

const children = [
  { name: "API", proc: apiProc },
  { name: "WEB", proc: webProc },
]

let isShuttingDown = false

const shutdown = (exitCode) => {
  if (isShuttingDown) return
  isShuttingDown = true

  children.forEach(({ proc }) => {
    if (
      proc.exitCode === null &&
      proc.signalCode === null
    ) {
      proc.kill("SIGTERM")
    }
  })

  // Hard ceiling: if either child ignores SIGTERM, force-exit after 5s
  // so docker stop doesn't escalate to SIGKILL on the orchestrator.
  setTimeout(() => process.exit(exitCode), 5000).unref()
}

children.forEach(({ name, proc }) => {
  proc.on("exit", (code, signal) => {
    console.log(
      `[${name}] exited (code=${code} signal=${signal})`,
    )
    shutdown(code === null ? 1 : code)
  })
  proc.on("error", (error) => {
    console.error(`[${name}] spawn error:`, error)
    shutdown(1)
  })
})

;["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(0))
})
