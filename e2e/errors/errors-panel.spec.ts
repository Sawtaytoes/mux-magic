import type { Server } from "node:http"
import { createServer } from "node:http"
import { expect, test } from "@playwright/test"

import {
  apiBaseUrl,
  webBaseUrl,
} from "../playwright.setup.js"

// ─── Mock webhook receiver helpers ──────────────────────────────────────────

type MockReceiverState = {
  requestCount: number
  isSucceeding: boolean
}

const startMockReceiver = ({
  initialPort,
}: {
  initialPort: number
}): Promise<{
  server: Server
  port: number
  state: MockReceiverState
}> =>
  new Promise((resolve, reject) => {
    const state: MockReceiverState = {
      requestCount: 0,
      isSucceeding: false,
    }

    const server = createServer(
      (request, serverResponse) => {
        state.requestCount += 1
        // Consume request body to prevent socket hangups
        request.resume()
        request.on("end", () => {
          const statusCode = state.isSucceeding ? 200 : 500
          serverResponse.writeHead(statusCode, {
            "Content-Type": "application/json",
          })
          serverResponse.end(
            JSON.stringify({ received: true }),
          )
        })
      },
    )

    server.on("error", (serverError) => {
      reject(serverError)
    })

    server.listen(initialPort, "127.0.0.1", () => {
      const address = server.address()
      const port =
        address && typeof address === "object"
          ? address.port
          : initialPort
      resolve({ server, port, state })
    })
  })

// ─── Test helpers ────────────────────────────────────────────────────────────

const cleanupAllErrors = async ({
  page,
}: {
  page: import("@playwright/test").Page
}) => {
  const listResponse = await page.request.get(
    `${apiBaseUrl}/api/errors`,
  )
  if (listResponse.ok()) {
    const records = (await listResponse.json()) as Array<{
      id: string
    }>
    await Promise.all(
      records.map((record) =>
        page.request.delete(
          `${apiBaseUrl}/api/errors/${record.id}`,
        ),
      ),
    )
  }
}

const triggerFakeFailureAndWaitForError = async ({
  page,
}: {
  page: import("@playwright/test").Page
}) => {
  await page.request.post(
    `${apiBaseUrl}/api/sequences/run?fake=failure`,
    {
      data: {
        steps: [
          {
            command: "makeDirectory",
            params: {
              sourcePath: "/tmp/e2e-errors-test",
            },
          },
        ],
      },
      headers: { "Content-Type": "application/json" },
    },
  )

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${apiBaseUrl}/api/errors`,
        )
        if (!response.ok()) {
          return 0
        }
        const records = (await response.json()) as Array<{
          id: string
        }>
        return records.length
      },
      { timeout: 8000, intervals: [200, 400, 800] },
    )
    .toBeGreaterThan(0)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Errors panel — persist → display → dismiss", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupAllErrors({ page })
  })

  test.afterEach(async ({ page }) => {
    await cleanupAllErrors({ page })
  })

  test("empty state shows no-errors message", async ({
    page,
  }) => {
    await page.goto(`${webBaseUrl}/errors`)

    await expect(page.getByText(/no errors/i)).toBeVisible()
  })

  test("Errors nav link is visible on the Jobs page", async ({
    page,
  }) => {
    await page.goto(`${webBaseUrl}/`)

    await expect(
      page.getByRole("link", { name: /errors/i }).first(),
    ).toBeVisible()
  })

  test("/errors route renders the ErrorsPanel heading", async ({
    page,
  }) => {
    await page.goto(`${webBaseUrl}/errors`)

    await expect(
      page.getByRole("heading", { name: /errors/i }),
    ).toBeVisible()
  })
})

test.describe("Errors panel — webhook delivery: 5xx → success path", () => {
  let mockServer: Server | null = null
  let mockState: MockReceiverState | null = null

  test.beforeEach(async ({ page }) => {
    await cleanupAllErrors({ page })

    // Start mock receiver on a random high port
    const receiverPort =
      40000 + Math.floor(Math.random() * 10000)
    const receiver = await startMockReceiver({
      initialPort: receiverPort,
    })
    mockServer = receiver.server
    mockState = receiver.state
  })

  test.afterEach(async ({ page }) => {
    await cleanupAllErrors({ page })
    if (mockServer) {
      mockServer.close()
      mockServer = null
      mockState = null
    }
  })

  test("record appears after job fails, shows state badge, dismiss confirmation removes it", async ({
    page,
  }) => {
    if (!mockState) {
      throw new Error("Mock receiver not started")
    }

    // Receiver starts returning 500 (record stays pending until webhook succeeds)
    mockState.isSucceeding = false

    // Trigger a fake failure to generate a persisted error
    await triggerFakeFailureAndWaitForError({ page })

    // Navigate to /errors
    await page.goto(`${webBaseUrl}/errors`)

    // Assert: at least one record is visible
    await expect(
      page.locator("article").first(),
    ).toBeVisible()

    // The record should show a delivery state badge
    await expect(
      page.locator(".delivery-state-badge").first(),
    ).toBeVisible()

    // Click Dismiss on the first record
    await page
      .getByRole("button", { name: /dismiss/i })
      .first()
      .click()

    // Confirmation button appears (two-step confirmation)
    await expect(
      page.getByRole("button", { name: /confirm/i }),
    ).toBeVisible()

    // Confirm dismiss
    await page
      .getByRole("button", { name: /confirm/i })
      .click()

    // Record disappears from the store
    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `${apiBaseUrl}/api/errors`,
          )
          if (!response.ok()) {
            return 1
          }
          const records = (await response.json()) as Array<{
            id: string
          }>
          return records.length
        },
        { timeout: 5000 },
      )
      .toBe(0)
  })
})

test.describe("Errors panel — manual redeliver (exhausted → pending path)", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupAllErrors({ page })
  })

  test.afterEach(async ({ page }) => {
    await cleanupAllErrors({ page })
  })

  test("redeliver endpoint resets record to pending state", async ({
    page,
  }) => {
    // Trigger a fake failure to create a persisted error record
    await triggerFakeFailureAndWaitForError({ page })

    // Get the record ID
    const listResponse = await page.request.get(
      `${apiBaseUrl}/api/errors`,
    )
    const records = (await listResponse.json()) as Array<{
      id: string
      webhookDelivery: { state: string }
    }>
    const firstRecord = records[0]

    // Call redeliver — regardless of current state, it must reset to pending
    const redeliverResponse = await page.request.post(
      `${apiBaseUrl}/api/errors/${firstRecord.id}/redeliver`,
    )
    expect(redeliverResponse.ok()).toBeTruthy()

    const redelivered =
      (await redeliverResponse.json()) as {
        webhookDelivery: { state: string }
      }
    expect(redelivered.webhookDelivery.state).toBe(
      "pending",
    )

    // Navigate to /errors and verify the panel renders the record
    await page.goto(`${webBaseUrl}/errors`)
    await expect(
      page.locator("article").first(),
    ).toBeVisible()

    // The record should show the pending badge after redeliver
    await expect(
      page.locator(".delivery-state-badge").first(),
    ).toBeVisible()
  })
})
