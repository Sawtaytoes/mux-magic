import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"
import type { MiddlewareHandler } from "hono"

import { createJob } from "../jobStore.js"
import { runSequenceJob } from "../sequenceRunner.js"

// ─── Auth middleware ──────────────────────────────────────────────────────────
//
// When HA_TRIGGER_TOKEN is set, every request to this sub-app must carry
// `X-HA-Token: <token>`. Unset → open (dev-only — document in .env.example).

const haAuthMiddleware: MiddlewareHandler = async (
  context,
  next,
) => {
  const token = process.env.HA_TRIGGER_TOKEN
  if (!token) {
    await next()
    return
  }

  const provided = context.req.header("X-HA-Token")
  if (provided !== token) {
    context.res = context.json(
      { error: "Unauthorized" },
      401,
    )
    return
  }

  await next()
}

// ─── Request / response schemas ───────────────────────────────────────────────

const haTriggerBodySchema = z
  .object({
    steps: z.array(z.unknown()).min(1),
    paths: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .openapi("HaTriggerBody", {
    description:
      "Sequence body to run. Accepts the same shape as POST /sequences/run (parsed JSON form).",
    example: {
      steps: [
        {
          command: "copyFiles",
          id: "step1",
          params: { sourcePath: "/tmp/src" },
        },
      ],
    },
  })

const haTriggerResponseSchema = z
  .object({
    jobId: z.string(),
    logsUrl: z.string(),
  })
  .openapi("HaTriggerAccepted", {
    example: {
      jobId: "9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f",
      logsUrl:
        "/jobs/9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f/logs",
    },
  })

// ─── Route ────────────────────────────────────────────────────────────────────

export const haTriggerRoutes = new OpenAPIHono()

haTriggerRoutes.use(haAuthMiddleware)

haTriggerRoutes.openapi(
  createRoute({
    description: `
HA-triggered sequence run. Behaves identically to POST /sequences/run but lives
on its own path so the shared-secret auth middleware can guard only this endpoint
without touching the web-UI's /sequences/run call.

**Auth:** when \`HA_TRIGGER_TOKEN\` env var is set, requests must include
\`X-HA-Token: <token>\`. Mismatch or missing header → 401. When the env var is
unset, the endpoint is open (suitable for local dev only).
    `.trim(),
    method: "post",
    path: "/jobs/named/sync-mux-magic",
    request: {
      body: {
        content: {
          "application/json": {
            schema: haTriggerBodySchema,
          },
        },
      },
    },
    responses: {
      202: {
        content: {
          "application/json": {
            schema: haTriggerResponseSchema,
          },
        },
        description:
          "Sequence job accepted. Subscribe to /jobs/:id/logs for the stream.",
      },
      401: {
        content: {
          "application/json": {
            schema: z
              .object({ error: z.string() })
              .openapi({
                example: { error: "Unauthorized" },
              }),
          },
        },
        description:
          "X-HA-Token header is missing or does not match HA_TRIGGER_TOKEN.",
      },
    },
    summary:
      "Run a sequence job triggered by Home Assistant.",
    tags: ["HA Trigger"],
  }),
  (context) => {
    const body = context.req.valid("json")

    const job = createJob({
      commandName: "sequence",
      params: body,
    })

    runSequenceJob(
      job.id,
      body as Parameters<typeof runSequenceJob>[1],
    )

    return context.json(
      {
        jobId: job.id,
        logsUrl: `/jobs/${job.id}/logs`,
      },
      202,
    )
  },
)
