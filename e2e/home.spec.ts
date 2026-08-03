import { expect, test } from "@playwright/test"

import { webBaseUrl } from "./playwright.setup.js"

// `/` is the tool picker (HomePage). Jobs moved to `/jobs`, the builder
// stays at `/builder`; both are reachable only through these two cards.
test.describe("Tool picker", () => {
  test("renders both tool cards", async ({ page }) => {
    await page.goto(`${webBaseUrl}/`)

    await expect(
      page.getByRole("heading", { name: "Mux Magic" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Builder" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Jobs" }),
    ).toBeVisible()
  })

  test("Jobs card navigates to /jobs", async ({ page }) => {
    await page.goto(`${webBaseUrl}/`)
    await page.getByRole("link", { name: /jobs/i }).click()

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(
      page.getByRole("heading", { name: /jobs/i }),
    ).toBeVisible()
  })

  test("Builder card navigates to /builder", async ({
    page,
  }) => {
    await page.goto(`${webBaseUrl}/`)
    await page
      .getByRole("link", { name: /builder/i })
      .click()

    await expect(page).toHaveURL(/\/builder$/)
  })
})
