import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openControlsMenu(page: Page) {
  await page
    .getByRole("button", { name: "Sequence actions" })
    .click()
}

// Stubs both the sequence run POST and the SSE log stream so tests
// run deterministically without a live server.
async function stubSequenceRun(
  page: Page,
  jobId = "test-job-bg-1",
) {
  // POST /sequences/run → returns { jobId }
  await page.route("**/sequences/run", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobId }),
    })
  })

  // GET /jobs/:id/logs (SSE) → streams a running event then stays open
  await page.route(
    `**/jobs/${jobId}/logs`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        // Send an initial line event so the modal shows content.
        body: 'data: {"line":"Starting sequence…"}\n\n',
      })
    },
  )

  // DELETE /jobs/:id → accepts cancel
  await page.route(`**/jobs/${jobId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    await route.continue()
  })
}

async function triggerRunSequence(page: Page) {
  await openControlsMenu(page)
  await page
    .getByRole("button", { name: /▶ Run Sequence/ })
    .click()
}

// ─── SequenceRunModal background flow ────────────────────────────────────────

test.describe("SequenceRunModal — background flow", () => {
  test.beforeEach(async ({ page }) => {
    await stubSequenceRun(page)
    await page.goto("/builder/")
  })

  test("modal opens when sequence is triggered", async ({
    page,
  }) => {
    await triggerRunSequence(page)
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeVisible()
  })

  test("'Run in background' button hides modal and shows badge", async ({
    page,
  }) => {
    await triggerRunSequence(page)
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeVisible()

    await page
      .getByRole("button", {
        name: /run in background/i,
      })
      .click()

    // Modal is hidden
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeHidden()

    // Badge appears in header
    await expect(
      page.getByRole("button", {
        name: /1 background job/i,
      }),
    ).toBeVisible()
  })

  test("clicking badge re-opens modal", async ({
    page,
  }) => {
    await triggerRunSequence(page)
    await page
      .getByRole("button", {
        name: /run in background/i,
      })
      .click()
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeHidden()

    // Click badge to re-open
    await page
      .getByRole("button", {
        name: /1 background job/i,
      })
      .click()

    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeVisible()
  })

  test("backdrop click backgrounds modal (no cancel)", async ({
    page,
  }) => {
    const deleteCalled: string[] = []
    await page.route("**/jobs/**", async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled.push(route.request().url())
      }
      await route.continue()
    })

    await triggerRunSequence(page)
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeVisible()

    // Click backdrop (outside dialog)
    await page.locator('[role="none"]').click({
      position: { x: 10, y: 10 },
    })

    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeHidden()
    // No DELETE should have been fired
    expect(deleteCalled).toHaveLength(0)
    // Badge should be visible
    await expect(
      page.getByRole("button", {
        name: /1 background job/i,
      }),
    ).toBeVisible()
  })

  test("Cancel button fires DELETE and removes badge", async ({
    page,
  }) => {
    await triggerRunSequence(page)

    // Wait for running state (Cancel button appears)
    await expect(
      page.getByRole("button", {
        name: /^cancel$/i,
      }),
    ).toBeVisible()

    const [deleteRequest] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.method() === "DELETE" &&
          req.url().includes("/jobs/"),
      ),
      page
        .getByRole("button", { name: /^cancel$/i })
        .click(),
    ])

    expect(deleteRequest).toBeTruthy()

    // Modal gone, badge gone
    await expect(
      page.locator("#sequence-run-modal"),
    ).toBeHidden()
    await expect(
      page.getByRole("button", {
        name: /background job/i,
      }),
    ).toBeHidden()
  })
})
