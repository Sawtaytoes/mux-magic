// Banner first — see `logBuildBanner.ts` for why this is a
// side-effect-only import at the top of the file (so `yarn api-server`
// gets the same boot banner as `yarn server` without going through
// `start-servers.ts`).
import "./logBuildBanner.js"

import { serve } from "@hono/node-server"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { app } from "./api/hono-routes.js"
import { installLogCapture } from "./api/logCapture.js"
import { setFakeModeEnabled } from "./fake-data/index.js"
import { logInfo } from "./tools/logMessage.js"
import { MAX_THREADS, PORT } from "./tools/port.js"
import { initTaskScheduler } from "./tools/taskScheduler.js"

// `--fake-data` (or MEDIA_TOOLS_FAKE_DATA=1) swaps every command's
// observable for a timer-driven scripted observable and short-circuits
// the read-only routes (/files, /inputs, /queries) to canned data.
// Lets designers / reviewers exercise the Jobs page and Builder run
// modal end-to-end without a real filesystem or external APIs.
//
// The per-request `?fake=1` query param toggles the same code path on
// a single call without restarting the server — see fake-data/index.ts.
const argv = await yargs(hideBin(process.argv))
  .option("fake-data", {
    type: "boolean",
    default: false,
    describe: "Boot the API server in fake-data mode: every command returns scripted observables, every read-only route returns canned data. Per-request `?fake=1` does the same on a single call.",
  })
  .strict(false)
  .help()
  .parseAsync()

const fakeDataFromEnv = (
  process.env.MEDIA_TOOLS_FAKE_DATA === "1"
  || process.env.MEDIA_TOOLS_FAKE_DATA === "true"
)

const fakeMode = Boolean(argv["fake-data"]) || fakeDataFromEnv

setFakeModeEnabled(fakeMode)

installLogCapture()
initTaskScheduler(MAX_THREADS)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    logInfo(
      "API SERVER LISTENING PORT",
      PORT,
    )
    if (fakeMode) {
      logInfo("API SERVER", "Running in --fake-data mode (every command emits scripted observables; read-only routes return canned data).")
    }
  },
)
