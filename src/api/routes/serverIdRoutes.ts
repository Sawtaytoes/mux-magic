import { randomBytes } from "node:crypto"

import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"

import { startSseKeepalive } from "../sseKeepalive.js"

// Generated once per process. Stays constant for the lifetime of the
// server and changes on every restart, so a client that compares the
// first bootId it sees against the one it receives after an
// EventSource auto-reconnect can detect "the server I was talking to
// is gone" and force a page reload to pick up any new HTML/JS.
const bootId = randomBytes(8).toString("hex")

export const serverIdRoutes = new OpenAPIHono()

serverIdRoutes.openapi(
  createRoute({
    method: "get",
    path: "/server-id/stream",
    summary: "Stream the server's per-process boot id (SSE)",
    description: "Emits a single { bootId } event on connect, then keepalives. The bootId is regenerated on every server restart, so clients can compare the first id they see against the id received after an auto-reconnect — a mismatch means the server restarted and the page should reload.",
    tags: ["Server"],
    responses: {
      200: {
        description: "Server-Sent Events stream emitting one { bootId } event on connect.",
        content: {
          "text/event-stream": {
            schema: { type: "string" },
          },
        },
      },
    },
  }),
  (context) =>
    streamSSE(context, async (stream) => {
      const stopKeepalive = startSseKeepalive(stream)

      await stream.writeSSE({ data: JSON.stringify({ bootId }) })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          stopKeepalive()
          resolve()
        })
      })

      stopKeepalive()
    }),
)
