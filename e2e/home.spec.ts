import { expect, test } from "@playwright/test"

import { webBaseUrl } from "./playwright.setup.js"

// `/` is the tool picker (HomePage). Jobs moved to `/jobs`, the builder
// stays at `/builder`; both are reachable only through these two tiles.
test.describe("Tool picker", () => {
  // The tile names were `<h3>`s inside the local `ToolCard`. Charcuterie's
  // `ActionTiles` does not emit a heading, on purpose: a heading LEVEL is a
  // statement about the document's outline, and a component that does not
  // know what surrounds it cannot pick one. The set is a named `group` and
  // each tile is a link with an accessible name, which is the handle the
  // other two tests in this file were already using.
  test("renders both tool tiles", async ({ page }) => {
    await page.goto(`${webBaseUrl}/`)

    await expect(
      page.getByRole("heading", { name: "Mux Magic" }),
    ).toBeVisible()
    await expect(
      page.getByRole("group", { name: "Pick a tool" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /^Builder/ }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /^Jobs/ }),
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
