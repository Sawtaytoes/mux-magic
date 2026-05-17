import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { registerLogSink } from "@mux-magic/tools"
import { streamSSE } from "hono/streaming"

import {
  getJob,
  getLatestJobProgress,
  getSubject,
} from "../jobStore.js"
import * as schemas from "../schemas.js"
import { startSseKeepalive } from "../sseKeepalive.js"

export const logsRoutes = new OpenAPIHono()

// SSE log stream.
// Each event data is JSON: { line: string } | { isDone: true, status: JobStatus }
// Replays buffered logs first, then streams live lines until the job finishes.
logsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs/:id/logs",
    summary: "Stream job logs via Server-Sent Events",
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
        description:
          "Server-Sent Events stream of job logs",
        content: {
          "text/event-stream": {
            schema: {
              type: "string",
              description: "SSE formatted log lines",
            },
          },
        },
      },
      404: {
        description: "Job not found",
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

    if (!job)
      return context.json({ error: "Job not found" }, 404)

    context.header("X-Accel-Buffering", "no")
    return streamSSE(context, async (stream) => {
      const stopKeepalive = startSseKeepalive(stream)

      const send = (payload: object) =>
        stream.writeSSE({
          data: JSON.stringify(payload),
        })

      // Each log line is tagged with its index in job.logs as the SSE
      // `id`. The client uses lastEventId to skip lines it has already
      // received — so a buffer replay on reconnect or disclosure
      // re-open doesn't accumulate duplicates client-side. Non-line
      // events (progress, prompt, done) intentionally have no id;
      // they're not append-only so dedup doesn't apply.
      for (
        let logIndex = 0;
        logIndex < job.logs.length;
        logIndex += 1
      ) {
        await stream.writeSSE({
          data: JSON.stringify({
            line: job.logs[logIndex],
          }),
          id: String(logIndex),
        })
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled" ||
        job.status === "skipped" ||
        job.status === "exited"
      ) {
        const latestProgress = getLatestJobProgress(job.id)
        if (latestProgress) await send(latestProgress)
        await send({
          isDone: true,
          status: job.status,
          results: job.results,
          outputs: job.outputs,
          error: job.error,
        })
        stopKeepalive()
        return
      }

      const subject = getSubject(job.id)

      if (!subject) {
        const finishedJob = getJob(job.id)
        const latestProgress = getLatestJobProgress(job.id)
        if (latestProgress) await send(latestProgress)
        await send({
          isDone: true,
          status: finishedJob?.status ?? job.status,
          results: finishedJob?.results ?? job.results,
          outputs: finishedJob?.outputs ?? null,
          error: finishedJob?.error ?? job.error,
        })
        stopKeepalive()
        return
      }

      // Live phase: lines emitted via the subject are appended-then-published
      // (see appendJobLog). At the moment a string event reaches us here,
      // job.logs.length - 1 is the index of THIS line — capture it as the
      // SSE id so it slots in after the replayed entries above.
      let nextLiveIndex = job.logs.length

      await new Promise<void>((resolve) => {
        const sub = subject.subscribe({
          complete: async () => {
            const completedJob = getJob(job.id)
            await send({
              isDone: true,
              status: completedJob?.status ?? job.status,
              results: completedJob?.results ?? job.results,
              outputs: completedJob?.outputs ?? null,
              error: completedJob?.error ?? job.error,
            })
            resolve()
          },
          error: async () => {
            const failedJob = getJob(job.id)
            await send({
              isDone: true,
              status: failedJob?.status ?? job.status,
              error: failedJob?.error ?? job.error,
            })
            resolve()
          },
          next: (event) => {
            if (typeof event === "string") {
              const liveLineIndex = nextLiveIndex
              nextLiveIndex += 1
              stream.writeSSE({
                data: JSON.stringify({ line: event }),
                id: String(liveLineIndex),
              })
            } else {
              stream.writeSSE({
                data: JSON.stringify(event),
              })
            }
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

// Server-wide structured-log feed. Subscribes a LogSink to the
// @mux-magic/tools logger for the lifetime of the SSE connection and
// JSON-encodes every record onto the wire. The legacy `/jobs/:id/logs`
// endpoint above stays untouched. Worker 2b's error store and any
// future log-analytics client read from here.
//
// No per-job filter: callers that only care about one job filter
// client-side on `record.jobId`. Keeping the server filter-free means
// records that fire outside a job context (server lifecycle warnings,
// startSpan trace IDs spanning no job, etc.) are still reachable.
logsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/logs/structured",
    summary:
      "Stream server-wide structured log records via Server-Sent Events",
    tags: ["Job Management"],
    responses: {
      200: {
        description:
          "SSE stream of JSON-encoded LogRecord objects",
        content: {
          "text/event-stream": {
            schema: {
              type: "string",
              description:
                "JSON-encoded LogRecord per event",
            },
          },
        },
      },
    },
  }),
  (context) => {
    context.header("X-Accel-Buffering", "no")
    return streamSSE(context, async (stream) => {
      const stopKeepalive = startSseKeepalive(stream)

      const unregister = registerLogSink((record) => {
        stream
          .writeSSE({ data: JSON.stringify(record) })
          .catch(() => {
            // Stream was closed mid-write; the onAbort handler will
            // unregister this sink. Swallowing here prevents an
            // unhandled rejection during teardown.
          })
      })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unregister()
          stopKeepalive()
          resolve()
        })
      })

      stopKeepalive()
    })
  },
)
