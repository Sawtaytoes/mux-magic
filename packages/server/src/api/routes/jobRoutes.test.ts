import { afterEach, beforeEach, describe, expect, test } from "vitest"

import {
  createJob,
  resetStore,
  updateJob,
} from "../jobStore.js"
import { jobRoutes } from "./jobRoutes.js"

// Hono in-process testing: jobRoutes is just a Hono sub-app, so
// jobRoutes.request(url) drives it without spinning up a real server.
// Each test seeds the in-memory job store, hits the route, and asserts
// on the JSON response.

afterEach(() => {
  resetStore()
})

describe("GET /jobs", () => {
  test("returns an empty array when no jobs exist", async () => {
    const response = await jobRoutes.request("/jobs")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  test("lists every job, omitting the logs field", async () => {
    const first = createJob({ commandName: "copyFiles", params: { sourcePath: "/a" } })
    const second = createJob({ commandName: "moveFiles", params: { sourcePath: "/b" } })

    const response = await jobRoutes.request("/jobs")
    const body = await response.json() as Array<Record<string, unknown>>

    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      id: first.id,
      commandName: "copyFiles",
      status: "pending",
    })
    expect(body[1]).toMatchObject({
      id: second.id,
      commandName: "moveFiles",
    })
    // logs are intentionally stripped from the list view.
    expect(body[0]).not.toHaveProperty("logs")
    expect(body[1]).not.toHaveProperty("logs")
  })

  test("reflects status updates from updateJob", async () => {
    const job = createJob({ commandName: "copyFiles" })
    updateJob(job.id, { status: "running", startedAt: new Date() })

    const response = await jobRoutes.request("/jobs")
    const body = await response.json() as Array<{ status: string }>

    expect(body[0].status).toBe("running")
  })
})

describe("GET /jobs/:id", () => {
  test("returns the full job (including logs) when found", async () => {
    const job = createJob({ commandName: "copyFiles", params: { sourcePath: "/in" } })

    const response = await jobRoutes.request(`/jobs/${job.id}`)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      id: job.id,
      commandName: "copyFiles",
      status: "pending",
    })
    expect(body).toHaveProperty("logs")
    expect(body.logs).toEqual([])
  })

  test("returns 404 with the canonical not-found error for unknown ids", async () => {
    const response = await jobRoutes.request("/jobs/this-id-does-not-exist")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Job not found" })
  })

  test("returns the job's accumulated error message after a failed run", async () => {
    const job = createJob({ commandName: "copyFiles" })
    updateJob(job.id, {
      status: "failed",
      error: "ENOENT: source path does not exist",
      completedAt: new Date(),
    })

    const response = await jobRoutes.request(`/jobs/${job.id}`)
    const body = await response.json() as { status: string; error: string | null }

    expect(body.status).toBe("failed")
    expect(body.error).toBe("ENOENT: source path does not exist")
  })
})

describe("DELETE /jobs/:id", () => {
  test("returns 404 with the canonical not-found error for unknown ids", async () => {
    const response = await jobRoutes.request("/jobs/this-id-does-not-exist", { method: "DELETE" })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Job not found" })
  })

  test("returns 202 with the cancelled job body when a running job is cancelled", async () => {
    const job = createJob({ commandName: "copyFiles", params: { sourcePath: "/in" } })
    updateJob(job.id, { status: "running", startedAt: new Date() })

    const response = await jobRoutes.request(`/jobs/${job.id}`, { method: "DELETE" })
    const body = await response.json() as { id: string; status: string; completedAt: string | null }

    expect(response.status).toBe(202)
    expect(body.id).toBe(job.id)
    expect(body.status).toBe("cancelled")
    expect(body.completedAt).not.toBeNull()
  })

  test("returns 204 (no body) when the job is already in a terminal state", async () => {
    const job = createJob({ commandName: "copyFiles" })
    updateJob(job.id, { status: "completed", completedAt: new Date() })

    const response = await jobRoutes.request(`/jobs/${job.id}`, { method: "DELETE" })

    expect(response.status).toBe(204)
    // Spec: 204 responses have no body.
    await expect(response.text()).resolves.toBe("")
  })

  test("returns 204 for a pending job (cancelJob is a no-op on non-running jobs)", async () => {
    // Pending is a transient state in this codebase (runJob fires synchronously
    // after createJob), but we shouldn't fail the call if a client races it.
    const job = createJob({ commandName: "copyFiles" })

    const response = await jobRoutes.request(`/jobs/${job.id}`, { method: "DELETE" })

    expect(response.status).toBe(204)
  })

  test("a second DELETE on the same just-cancelled job is idempotent (returns 204)", async () => {
    const job = createJob({ commandName: "copyFiles" })
    updateJob(job.id, { status: "running", startedAt: new Date() })

    const first = await jobRoutes.request(`/jobs/${job.id}`, { method: "DELETE" })
    expect(first.status).toBe(202)

    const second = await jobRoutes.request(`/jobs/${job.id}`, { method: "DELETE" })
    expect(second.status).toBe(204)
  })
})
