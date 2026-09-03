import type { Job } from "@mux-magic/web/job-types"
import { expect, test } from "@playwright/test"

import { webBaseUrl } from "./playwright.setup.js"

// playwright.config.ts sets baseURL to the web server (port 5173). Tests
// can use relative paths (page.goto("/")) for SPA navigation. webBase is
// kept for tests that were already using it and not changed in this pass.
const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: "test-job-1",
  commandName: "copyFiles",
  completedAt: null,
  error: null,
  logs: [],
  outputFolderName: null,
  outputs: null,
  params: null,
  parentJobId: null,
  pauseReason: null,
  results: [],
  startedAt: null,
  status: "running",
  stepId: null,
  threadCountClaim: null,
  ...overrides,
})

test.describe("Jobs page — SSE stream", () => {
  test("renders heading and empty-state when no jobs arrive", async ({
    page,
  }) => {
    // Stub the stream with an empty body — no job events.
    await page.route("**/jobs/stream*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: "",
      })
    })

    await page.goto(`${webBaseUrl}/jobs`)

    await expect(
      page.getByRole("heading", { name: "Jobs" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Nothing to show",
      }),
    ).toBeVisible()
    // Two "Sequence Builder" links exist (header nav + empty-state). Either being
    // visible confirms the page loaded correctly.
    await expect(
      page
        .getByRole("link", { name: /Sequence Builder/ })
        .first(),
    ).toBeVisible()
  })

  test("page links navigate without reloading the app", async ({
    page,
  }) => {
    await page.route("**/jobs/stream*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      })
    })

    await page.goto(`${webBaseUrl}/jobs`)
    await page.evaluate(() => {
      document.body.dataset.routerMarker = "kept"
    })
    await page
      .getByRole("link", { name: /Sequence Builder/ })
      .first()
      .click()

    await expect(page).toHaveURL(/\/builder$/)
    await expect(page.locator("body")).toHaveAttribute(
      "data-router-marker",
      "kept",
    )
  })

  test("exited is switched off by default, and switching it on re-requests the stream", async ({
    page,
  }) => {
    const requestedUrls: string[] = []

    await page.route("**/jobs/stream*", async (route) => {
      requestedUrls.push(route.request().url())
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: "",
      })
    })

    await page.goto(`${webBaseUrl}/jobs`)

    const exitedChip = page.getByRole("button", {
      name: /^exited/,
    })
    await expect(exitedChip).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    // The default connect asks the server to leave exited out, which
    // is what keeps thousands of them off the wire.
    await expect
      .poll(() => requestedUrls.length)
      .toBeGreaterThan(0)
    expect(requestedUrls.at(-1)).toContain("status=")
    expect(requestedUrls.at(-1)).not.toContain("exited")

    await exitedChip.click()

    await expect(exitedChip).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    // Switching it on has to RECONNECT — the hidden jobs were never
    // sent, so nothing short of a fresh replay can show them.
    await expect
      .poll(() => requestedUrls.length)
      .toBeGreaterThan(1)
    expect(requestedUrls.at(-1)).not.toContain("status=")
  })

  test("job card appears when SSE delivers a running job", async ({
    page,
  }) => {
    const job = makeJob({
      id: "job-running-001",
      commandName: "copyFiles",
      status: "running",
    })

    await page.route("**/jobs/stream*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body: `data: ${JSON.stringify(job)}\n\n`,
      })
    })

    await page.goto(`${webBaseUrl}/jobs`)

    const jobCard = page.getByRole("article")
    await expect(jobCard).toBeVisible()
    // Job ID is shown in the card meta section.
    await expect(jobCard).toContainText("job-running-001")
    // StatusBadge shows the current status. Multiple "running" text nodes may
    // exist inside the card (badge + progress area); use the status-badge class.
    await expect(
      jobCard.locator(".status-badge"),
    ).toContainText("running")
  })

  test("job card status updates to 'completed' when SSE delivers completion event", async ({
    page,
  }) => {
    const runningJob = makeJob({
      id: "job-complete-002",
      commandName: "moveFiles",
      status: "running",
    })
    const completedJob: Job = {
      ...runningJob,
      status: "completed",
    }

    await page.route("**/jobs/stream*", async (route) => {
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

    await page.goto(`${webBaseUrl}/jobs`)

    const jobCard = page.getByRole("article")
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
      commandName: "makeDirectory",
      status: "completed",
    })
    const jobBeta = makeJob({
      id: "job-beta",
      commandName: "deleteFilesByExtension",
      status: "failed",
    })

    await page.route("**/jobs/stream*", async (route) => {
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

    await page.goto(`${webBaseUrl}/jobs`)

    await expect(page.getByRole("article")).toHaveCount(2)
    // Newest first — JobsList reverses insertion order.
    await expect(
      page.getByRole("article").first(),
    ).toContainText("job-beta")
    await expect(
      page.getByRole("article").last(),
    ).toContainText("job-alpha")
  })

  test("child jobs (parentJobId set) do not appear as top-level cards", async ({
    page,
  }) => {
    const parentJob = makeJob({
      id: "parent-job",
      commandName: "copyFiles",
      status: "running",
    })
    const childJob = makeJob({
      id: "child-job",
      commandName: "copyFiles",
      status: "running",
      parentJobId: "parent-job",
    })

    await page.route("**/jobs/stream*", async (route) => {
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

    await page.goto(`${webBaseUrl}/jobs`)

    // Only the parent should appear at the top level.
    await expect(page.getByRole("article")).toHaveCount(1)
    await expect(page.getByRole("article")).toContainText(
      "parent-job",
    )
  })
})
