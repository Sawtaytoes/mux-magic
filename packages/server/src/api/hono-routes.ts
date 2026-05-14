import { OpenAPIHono } from "@hono/zod-openapi"

import { commandRoutes } from "./routes/commandRoutes.js"
import { addDocRoutes } from "./routes/docRoutes.js"
import { featuresRoutes } from "./routes/featuresRoutes.js"
import { fileRoutes } from "./routes/fileRoutes.js"
import { haTriggerRoutes } from "./routes/haTriggerRoutes.js"
import { inputRoutes } from "./routes/inputRoutes.js"
import { jobRoutes } from "./routes/jobRoutes.js"
import { logsRoutes } from "./routes/logRoutes.js"
import { queryRoutes } from "./routes/queryRoutes.js"
import { sequenceRoutes } from "./routes/sequenceRoutes.js"
import { serverIdRoutes } from "./routes/serverIdRoutes.js"
import { transcodeRoutes } from "./routes/transcodeRoutes.js"
import { versionRoutes } from "./routes/versionRoutes.js"

export const app = new OpenAPIHono()

app.route("/", featuresRoutes)
app.route("/", jobRoutes)
app.route("/", logsRoutes)
app.route("/", inputRoutes)
app.route("/", commandRoutes)
app.route("/", queryRoutes)
app.route("/", sequenceRoutes)
app.route("/", haTriggerRoutes)
app.route("/", fileRoutes)
app.route("/", serverIdRoutes)
app.route("/", transcodeRoutes)
app.route("/", versionRoutes)

addDocRoutes(app)
