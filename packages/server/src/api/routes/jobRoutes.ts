import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"
import { z } from "zod"

import { isFakeRequest } from "../../fake-data/index.js"
import {
  cancelJob,
  getAllJobs,
  getJob,
  jobEvents$,
} from "../jobStore.js"
import * as schemas from "../schemas.js"
import { startSseKeepalive } from "../sseKeepalive.js"

const jobDetailSchema = z.object({
  id: z.string().describe("Job ID"),
  commandName: z.string().describe("Command name"),
  status: z
    .enum([
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
      "skipped",
      "exited",
    ])
    .describe(
      "Job status. `skipped` is set on sequence-step child jobs that never ran because an earlier step failed or the umbrella was cancelled before reaching them; distinct from `cancelled`, which means the job was actively running when it got interrupted. `exited` is set on the umbrella job and every later flat step when a flow-control step (e.g. `exitIfEmpty`) signals a planned early exit — distinct from both `completed` (the sequence ran every step) and `skipped` (the rest of the sequence didn't run due to a failure or cancellation).",
    ),
  params: z.unknown().describe("Command parameters"),
  results: z
    .array(z.unknown())
    .optional()
    .describe("Job results"),
  outputs: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe(
      "Named runtime outputs declared by the command (null when none were produced or the job is in flight)",
    ),
  logs: z.array(z.string()).describe("Log lines"),
  error: z
    .string()
    .nullable()
    .describe("Error message if job failed"),
  startedAt: z
    .string()
    .nullable()
    .describe("Job start timestamp"),
  completedAt: z
    .string()
    .nullable()
    .describe("Job completion timestamp"),
  parentJobId: z
    .string()
    .nullable()
    .describe(
      "If this job is a step inside a sequence, the umbrella sequence job's id. null for top-level jobs.",
    ),
  stepId: z
    .string()
    .nullable()
    .describe(
      "Sequence-step identifier (matches the SequenceStep `id` field — either user-supplied or auto-assigned `step1`, `step2`, …). Only set on sequence-step child jobs; null for top-level jobs.",
    ),
})

const jobListSchema = z.array(
  jobDetailSchema
    .omit({ logs: true })
    .describe("Job list entry"),
)

export const jobRoutes = new OpenAPIHono()

jobRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs/stream",
    summary:
      "Stream all job updates via Server-Sent Events",
    tags: ["Job Management"],
    responses: {
      200: {
        description:
          "Server-Sent Events stream of job updates. Each event is a JSON job object (without logs). Replays all existing jobs on connect, then streams new creates and status changes.",
        content: {
          "text/event-stream": {
            schema: { type: "string" },
          },
        },
      },
    },
  }),
  (context) => {
    context.header("X-Accel-Buffering", "no")
    return streamSSE(context, async (stream) => {
      const stopKeepalive = startSseKeepalive(stream)

      const send = (job: object) =>
        stream.writeSSE({ data: JSON.stringify(job) })

      for (const { logs: _logs, ...job } of getAllJobs()) {
        await send(job)
      }

      await new Promise<void>((resolve) => {
        const sub = jobEvents$.subscribe({
          error: () => resolve(),
          next: (job) => {
            stream.writeSSE({ data: JSON.stringify(job) })
          },
        })

        stream.onAbort(() => {
          stopKeepalive()
          sub.unsubscribe()
          resolve()
        })
      })

      stopKeepalive()
    })
  },
)

jobRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs",
    summary: "List all jobs",
    tags: ["Job Management"],
    responses: {
      200: {
        description: "List of all jobs",
        content: {
          "application/json": {
            schema: jobListSchema,
          },
        },
      },
    },
  }),
  (context) => {
    const list = getAllJobs().map(
      ({ logs: _logs, ...rest }) => rest,
    )

    return context.json(list)
  },
)

jobRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs/:id",
    summary: "Get job details",
    tags: ["Job Management"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Job ID",
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Job details",
        content: {
          "application/json": {
            schema: jobDetailSchema,
          },
        },
      },
      404: {
        description: schemas.JOB_NOT_FOUND,
        content: {
          "application/json": {
            schema: schemas.jobNotFoundSchema,
          },
        },
      },
    },
  }),
  (context) => {
    const job = getJob(context.req.param("id"))

    if (!job) {
      return context.json(
        { error: schemas.JOB_NOT_FOUND },
        404,
      )
    }

    return context.json(job, 200)
  },
)

jobRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/jobs/:id",
    summary: "Cancel a running job",
    description:
      "Idempotent. 202 with the cancelled job body when a running job was actually cancelled (the child-process tree-kill is async so the response may precede the OS-level death by a few ms). 204 No Content when the job is already in a terminal state — preserves history rather than failing the call. 404 when no job with that id exists.",
    tags: ["Job Management"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Job ID",
        schema: { type: "string" },
      },
    ],
    responses: {
      202: {
        description:
          "Job was running; cancellation has been initiated. Body is the job snapshot at the moment status flipped to cancelled.",
        content: {
          "application/json": {
            schema: jobDetailSchema,
          },
        },
      },
      204: {
        description:
          "Job exists but is already in a terminal state (completed / failed / cancelled). No-op.",
      },
      404: {
        description: schemas.JOB_NOT_FOUND,
        content: {
          "application/json": {
            schema: schemas.jobNotFoundSchema,
          },
        },
      },
    },
  }),
  (context) => {
    const id = context.req.param("id")
    if (isFakeRequest(context)) {
      return context.body(null, 204)
    }
    const job = getJob(id)

    if (!job) {
      return context.json(
        { error: schemas.JOB_NOT_FOUND },
        404,
      )
    }

    const isCancelled = cancelJob(id)
    if (!isCancelled) {
      // Job exists but is already terminal — idempotent no-op.
      return context.body(null, 204)
    }

    // cancelJob mutated the job in place; re-read for the response.
    const cancelledJob = getJob(id)
    if (!cancelledJob) return context.body(null, 500)
    return context.json(cancelledJob, 202)
  },
)
