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

// CORS: mux-magic is a single-user local tool. The web UI and api can
// run in the same process or as two processes on adjacent ports; in
// either case requests are local. An `*` allow-list keeps the local
// flow working when `window.__API_BASE__` injects an absolute api URL
// (e.g. when serving the SPA from a sibling host). Tighten this if the
// deployment posture ever changes to a public surface.
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
