// Browser-side MSW request handlers. Loaded via /mocks/browser.js when
// the user opts in with `?mock=1` or `localStorage.useMocks === '1'`.
//
// MSW is consumed from esm.sh because public/ ships unbundled — the
// project intentionally has no client-side build step. The version is
// pinned to match what's listed in package.json's devDependencies so a
// stale CDN cache and the Node-side handler module can't drift apart.
import { http, HttpResponse, delay } from "https://esm.sh/msw@2.14.4"

import {
  commandJobMap,
  mockDirectoryEntries,
  mockFilesList,
  mockJobIds,
  mockJobLogs,
  mockJobs,
  mockSearchMalResults,
} from "./fixtures.js"

// SSE helper. MSW v2 returns SSE by responding with a `ReadableStream`
// whose chunks are Uint8Array-encoded `data: <json>\n\nid: <n>\n\n`
// lines, plus the `text/event-stream` content-type. The encoder, the
// id-tagging convention (used by the real /jobs/:id/logs route — the
// client's lastLogIndexByJobId dedup relies on it), and the keepalive
// comment line all match what the production server emits, so the
// frontend code paths exercise the same parsing logic in mock mode as
// they would against a live server.
const encoder = new TextEncoder()

const sseChunk = (
  payload,
  id,
) => {
  const lines = []
  if (id !== undefined && id !== null) lines.push(`id: ${id}`)
  lines.push(`data: ${JSON.stringify(payload)}`)
  lines.push("", "")
  return encoder.encode(lines.join("\n"))
}

// Builds a SSE Response that replays a finite list of frames then leaves
// the stream open (never closes) so the client thinks the job is still
// alive and keeps the connection. Suitable for "running" mock jobs.
const sseResponseLive = (frames) => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        controller.enqueue(frame)
        await delay(120)
      }
      // Intentionally don't close — the running job stays running. The
      // browser will close when the page navigates away.
    },
  })
  return new HttpResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// Builds an SSE Response that replays frames then closes the stream.
// Used for terminal jobs (completed / failed) where the client expects
// a `{ done: true }` event followed by EOF.
const sseResponseTerminal = (frames) => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        controller.enqueue(frame)
        await delay(40)
      }
      controller.close()
    },
  })
  return new HttpResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// Logs replay for a given job id — every line tagged with its index
// (matches the real server's id convention so lastLogIndex dedup works
// the same way), then the terminal envelope when the job is finished.
const buildLogFramesForJob = (jobId) => {
  const lines = mockJobLogs[jobId] ?? []
  const frames = lines.map((line, index) => sseChunk({ line }, index))
  const job = mockJobs.find((entry) => entry.id === jobId)
  const isTerminal =
    job
    && job.status !== "running"
    && job.status !== "pending"
  if (isTerminal) {
    frames.push(
      sseChunk({
        done: true,
        status: job.status,
        results: job.results ?? [],
        outputs: job.outputs ?? null,
      }),
    )
  }
  return frames
}

export const handlers = [
  // /jobs/stream — single replay of every canned job, then the stream
  // stays open so the page sits in "Connected" rather than reconnect
  // looping. createTolerantEventSource on the client treats this as a
  // healthy connection.
  http.get("*/jobs/stream", () => (
    sseResponseLive(
      mockJobs.map((job) => sseChunk(job)),
    )
  )),

  // /jobs/:id/logs — replays the buffered lines for the requested job,
  // tagged with their index so the client's lastLogIndex dedup sees
  // the same id sequence as it would against the real server. For
  // terminal jobs the stream emits `{ done: true }` and closes; for
  // running jobs the stream stays open after the replay.
  http.get("*/jobs/:id/logs", ({ params }) => {
    const id = String(params.id)
    const frames = buildLogFramesForJob(id)
    const job = mockJobs.find((entry) => entry.id === id)
    if (job && (job.status === "running" || job.status === "pending")) {
      return sseResponseLive(frames)
    }
    return sseResponseTerminal(frames)
  }),

  // POST /jobs is not a real route in this server — single-command
  // creation goes through POST /commands/:name. We register a handler
  // anyway so the spec the orchestrator wrote stays satisfied; if the
  // UI ever does call POST /jobs (e.g. a future unified-create endpoint)
  // it'll get a sensible canned response.
  http.post("*/jobs", async () => (
    HttpResponse.json(
      {
        jobId: mockJobIds.succeededJobId,
        logsUrl: `/jobs/${mockJobIds.succeededJobId}/logs`,
        outputFolderName: null,
      },
      { status: 202 },
    )
  )),

  // Real production path for single-command create. Dispatches to a
  // command-specific fixture job when one exists, otherwise falls back to
  // the generic succeeded job so unknown commands still get a response.
  http.post("*/commands/:name", async ({ params }) => {
    const jobId = commandJobMap[String(params.name)] ?? mockJobIds.succeededJobId
    return HttpResponse.json(
      {
        jobId,
        logsUrl: `/jobs/${jobId}/logs`,
        outputFolderName: null,
      },
      { status: 202 },
    )
  }),

  http.post("*/sequences/run", async () => (
    HttpResponse.json(
      {
        jobId: mockJobIds.inProgressUmbrellaId,
        logsUrl: `/jobs/${mockJobIds.inProgressUmbrellaId}/logs`,
        outputFolderName: null,
      },
      { status: 202 },
    )
  )),

  // Plain JSON list of jobs (no `logs` key — same as the real route).
  http.get("*/files", () => (
    HttpResponse.json(mockFilesList, { status: 200 })
  )),
  // The real listing endpoint — handler covers both shapes so the spec
  // stays satisfied without requiring a UI change.
  http.get("*/files/list", () => (
    HttpResponse.json(mockFilesList, { status: 200 })
  )),

  // Rename in mock mode — accept whatever paths the UI sends and report
  // success without touching the real filesystem. Mirrors the server's
  // ?fake=1 short-circuit so the Fix-Unnamed → Rename Selected flow
  // works under either dry-run or useMocks (or both at once).
  http.post("*/files/rename", async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    return HttpResponse.json({
      ok: true,
      newPath: body?.newPath ?? null,
      error: null,
    }, { status: 200 })
  }),

  // Inputs (Builder typeahead) — the spec called for /inputs; the
  // production route is /queries/listDirectoryEntries. Mocking both.
  http.get("*/inputs", () => (
    HttpResponse.json(mockDirectoryEntries, { status: 200 })
  )),
  http.get("*/queries/listDirectoryEntries", () => (
    HttpResponse.json(mockDirectoryEntries, { status: 200 })
  )),
  http.get("*/queries/searchMal", () => (
    HttpResponse.json(mockSearchMalResults, { status: 200 })
  )),

  // Top-level /queries fallback so the spec's `GET /queries` is covered
  // even though no real route by that name exists. Returns the search
  // canned data so any caller gets something well-formed.
  http.get("*/queries", () => (
    HttpResponse.json(mockSearchMalResults, { status: 200 })
  )),
]
