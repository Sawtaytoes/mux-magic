import { OpenAPIHono } from "@hono/zod-openapi"
import { logError } from "@mux-magic/tools"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"

import { commandRoutes } from "./routes/commandRoutes.js"
import { addDocRoutes } from "./routes/docRoutes.js"
import { errorRoutes } from "./routes/errorRoutes.js"
import { featuresRoutes } from "./routes/featuresRoutes.js"
import { fileRoutes } from "./routes/fileRoutes.js"
import { inputRoutes } from "./routes/inputRoutes.js"
import { jobRoutes } from "./routes/jobRoutes.js"
import { logsRoutes } from "./routes/logRoutes.js"
import { queryRoutes } from "./routes/queryRoutes.js"
import { sequenceRoutes } from "./routes/sequenceRoutes.js"
import { serverIdRoutes } from "./routes/serverIdRoutes.js"
import { systemRoutes } from "./routes/systemRoutes.js"
import { templateRoutes } from "./routes/templateRoutes.js"
import { transcodeRoutes } from "./routes/transcodeRoutes.js"
import { versionRoutes } from "./routes/versionRoutes.js"

export const app = new OpenAPIHono()

// CORS: mux-magic is a single-user local tool. After worker 29 the SPA
// and the API are same-origin (one Hono front-door, /api/* mounts this
// sub-app), so CORS is effectively a no-op in normal use. The reflect-
// origin allow-list stays as a safety net for direct-API consumers
// (curl, Home Assistant, openapi clients on other hosts) that hit /api
// across origins. Tighten if the deployment posture ever changes to a
// multi-tenant public surface.
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],
    allowHeaders: ["Content-Type"],
  }),
)

// Global error net. Without this, an unhandled throw inside any handler
// (e.g. a filesystem write failing because APP_DATA_DIR is read-only or
// not writable by the container user) collapses to Hono's default bare
// "Internal Server Error" text — the real cause is lost and the UI shows
// a useless 500. Here we log the full stack to stderr (mux-magic is a
// single-user local tool, so echoing the message back to the client is
// fine and is what makes the failure diagnosable) and return a structured
// JSON body the web layer can surface verbatim.
app.onError((error, context) => {
  // HTTPException carries its own intended response (validation failures,
  // explicit 4xx thrown by handlers) — pass it through untouched.
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  const details =
    error instanceof Error ? error.message : String(error)
  logError(
    "API",
    `${context.req.method} ${context.req.path} failed`,
    error instanceof Error
      ? (error.stack ?? error.message)
      : String(error),
  )
  return context.json(
    { error: "internal server error", details },
    500,
  )
})

app.route("/", featuresRoutes)
app.route("/", jobRoutes)
app.route("/", logsRoutes)
app.route("/", inputRoutes)
app.route("/", commandRoutes)
app.route("/", queryRoutes)
app.route("/", sequenceRoutes)
app.route("/", fileRoutes)
app.route("/", serverIdRoutes)
app.route("/", systemRoutes)
app.route("/", templateRoutes)
app.route("/", transcodeRoutes)
app.route("/", versionRoutes)
app.route("/", errorRoutes)

addDocRoutes(app)
