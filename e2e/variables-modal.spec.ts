import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openVariablesModal(page: Page) {
  await page
    .getByRole("button", { name: "Variables" })
    .click()
  await expect(
    page.getByRole("dialog", { name: /edit variables/i }),
  ).toBeVisible()
}

// ─── Edit Variables modal ─────────────────────────────────────────────────────

test.describe("Edit Variables modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("Variables button opens the Edit Variables modal", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Variables" })
      .click()
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeVisible()
  })

  test("modal shows empty state when no variables exist", async ({
    page,
  }) => {
    await openVariablesModal(page)
    await expect(
      page.getByRole("dialog").getByText(/no variables/i),
    ).toBeVisible()
  })

  test("Escape key closes the modal", async ({ page }) => {
    await openVariablesModal(page)
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeHidden()
  })

  test("close button closes the modal", async ({
    page,
  }) => {
    await openVariablesModal(page)
    await page
      .getByRole("button", { name: /close/i })
      .click()
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeHidden()
  })

  test("Add Variable → Path creates a path variable in the modal", async ({
    page,
  }) => {
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /^path$/i })
      .click()
    // A new variable card should appear inside the modal.
    await expect(
      dialog.getByText("path variable"),
    ).toBeVisible()
  })

  test("sequence list no longer renders path variable cards inline", async ({
    page,
  }) => {
    // Inline variable cards should NOT exist outside the modal/sidebar.
    // The BuilderPathVariableList has been removed from BuilderPage.
    await expect(
      page.locator("[data-path-var]"),
    ).toHaveCount(0)
  })
})

// ─── Variables sidebar ────────────────────────────────────────────────────────

test.describe("Variables sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("sidebar is present with Variables heading", async ({
    page,
  }) => {
    // The sidebar always renders in the DOM; CSS hides it below lg.
    await expect(
      page.getByRole("complementary", {
        name: "Variables",
      }),
    ).toBeAttached()
  })
})

// ─── Variable YAML round-trip ─────────────────────────────────────────────────

test.describe("Variable YAML round-trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("path variable created in modal survives YAML copy-reload", async ({
    page,
  }) => {
    // Create a path variable via the modal.
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /^path$/i })
      .click()

    // Give it a label and a value so toYamlStr sees a non-empty variable.
    const labelInput = dialog.getByRole("textbox").first()
    await labelInput.fill("Media Root")
    const valueInput =
      dialog.getByPlaceholder(/\/mnt\/media/i)
    await valueInput.fill("/mnt/media")

    // Close the modal via the close button so we can access header controls.
    await dialog
      .getByRole("button", { name: /close/i })
      .click()
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeHidden()

    // Copy YAML via header controls.
    await page
      .getByRole("button", { name: "Sequence actions" })
      .click()
    await page
      .getByRole("button", { name: "View YAML" })
      .click()
    const yamlModal = page.locator("#yaml-modal")
    await expect(yamlModal).toBeVisible()
    const yamlText = await yamlModal
      .locator("#yaml-out")
      .innerText()
    await page.keyboard.press("Escape")

    // Verify the YAML contains the variable.
    expect(yamlText).toContain("Media Root")

    // Reload via LoadModal paste.
    await page
      .getByRole("button", { name: "Sequence actions" })
      .click()
    await page.locator("#load-btn").click()
    await page.evaluate((text: string) => {
      const dt = new DataTransfer()
      dt.setData("text/plain", text)
      document.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      )
    }, yamlText)

    // Modal closes on successful load.
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeHidden()

    // Re-open modal and verify the variable survived.
    await openVariablesModal(page)
    await expect(
      page
        .getByRole("dialog")
        .locator("input[value='Media Root']"),
    ).toBeVisible()
  })
})
