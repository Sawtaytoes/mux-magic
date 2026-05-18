import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"

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
