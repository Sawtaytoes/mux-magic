import { expect, test } from "@playwright/test"

import type { Job } from "../packages/web/src/types"

// Playwright's baseURL points to the API server (port 3000).  After W3, the
// React SPA is served by the web server (port 4173).  The web server URL is
// derived from the WEB_PORT env var (default 4173), matching the second
// webServer entry in playwright.config.ts.
const webPort = Number(process.env.WEB_PORT ?? 4173)
const webBase = `http://localhost:${webPort}`

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: "test-job-1",
  command: "copyFiles",
  status: "running",
  ...overrides,
})

test.describe("Jobs page — SSE stream", () => {
  test("renders heading and empty-state when no jobs arrive", async ({
    page,
  }) => {
    // Stub the stream with an empty body — no job events.
    await page.route("**/jobs/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: "",
      })
    })

    await page.goto(`${webBase}/`)

    await expect(
      page.getByRole("heading", { name: "Jobs" }),
    ).toBeVisible()
    await expect(
      page.getByText(/No jobs yet/),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Sequence Builder/ }),
    ).toBeVisible()
  })

  test("job card appears when SSE delivers a running job", async ({
    page,
  }) => {
    const job = makeJob({
      id: "job-running-001",
      command: "copyFiles",
      commandName: "Copy Files",
      status: "running",
    })

    await page.route("**/jobs/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: `data: ${JSON.stringify(job)}\n\n`,
      })
    })

    await page.goto(`${webBase}/`)

    // The JobCard renders an article with data-testid="job-card".
    const jobCard = page.locator("[data-testid='job-card']")
    await expect(jobCard).toBeVisible()
    // Job ID is shown in the card meta section.
    await expect(jobCard).toContainText("job-running-001")
    // StatusBadge shows the current status.
    await expect(jobCard.getByText("running")).toBeVisible()
  })

  test("job card status updates to 'completed' when SSE delivers completion event", async ({
    page,
  }) => {
    const runningJob = makeJob({
      id: "job-complete-002",
      command: "moveFiles",
      commandName: "Move Files",
      status: "running",
    })
    const completedJob: Job = {
      ...runningJob,
      status: "completed",
    }

    await page.route("**/jobs/stream", async (route) => {
      const sseBody = [
        `data: ${JSON.stringify(runningJob)}\n\n`,
        `data: ${JSON.stringify(completedJob)}\n\n`,
      ].join("")
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: sseBody,
      })
    })

    await page.goto(`${webBase}/`)

    const jobCard = page.locator("[data-testid='job-card']")
    await expect(jobCard).toBeVisible()
    await expect(
      jobCard.getByText("completed"),
    ).toBeVisible()
  })

  test("multiple top-level jobs each render their own card", async ({
    page,
  }) => {
    const jobAlpha = makeJob({
      id: "job-alpha",
      command: "makeDirectory",
      commandName: "Make Directory",
      status: "completed",
    })
    const jobBeta = makeJob({
      id: "job-beta",
      command: "deleteFilesByExtension",
      commandName: "Delete Files by Extension",
      status: "failed",
    })

    await page.route("**/jobs/stream", async (route) => {
      const sseBody = [
        `data: ${JSON.stringify(jobAlpha)}\n\n`,
        `data: ${JSON.stringify(jobBeta)}\n\n`,
      ].join("")
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: sseBody,
      })
    })

    await page.goto(`${webBase}/`)

    await expect(
      page.locator("[data-testid='job-card']"),
    ).toHaveCount(2)
    // Newest first — JobsList reverses insertion order.
    await expect(
      page.locator("[data-testid='job-card']").first(),
    ).toContainText("job-beta")
    await expect(
      page.locator("[data-testid='job-card']").last(),
    ).toContainText("job-alpha")
  })

  test("child jobs (parentJobId set) do not appear as top-level cards", async ({
    page,
  }) => {
    const parentJob = makeJob({
      id: "parent-job",
      command: "copyFiles",
      commandName: "Copy Files",
      status: "running",
    })
    const childJob = makeJob({
      id: "child-job",
      command: "copyFiles",
      commandName: "Copy Files",
      status: "running",
      parentJobId: "parent-job",
    })

    await page.route("**/jobs/stream", async (route) => {
      const sseBody = [
        `data: ${JSON.stringify(parentJob)}\n\n`,
        `data: ${JSON.stringify(childJob)}\n\n`,
      ].join("")
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: sseBody,
      })
    })

    await page.goto(`${webBase}/`)

    // Only the parent should appear at the top level.
    await expect(
      page.locator("[data-testid='job-card']"),
    ).toHaveCount(1)
    await expect(
      page.locator("[data-testid='job-card']"),
    ).toContainText("parent-job")
  })
})
