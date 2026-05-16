import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openVariablesModal(page: Page) {
  // Scope to the header toolbar — there is a second "Variables" button
  // inside `#page-actions-controls` at intermediate widths, and the page
  // header is designed so this scoping disambiguates.
  await page
    .getByRole("toolbar", { name: "Header actions" })
    .getByRole("button", { name: "Variables" })
    .click()
  await expect(
    page.getByRole("dialog", { name: /edit variables/i }),
  ).toBeVisible()
}

// ─── Edit Variables modal ─────────────────────────────────────────────────────

// The header "Variables" button is `lg:hidden` because the desktop layout
// surfaces variables via the always-visible sidebar instead. Use a sub-lg
// viewport so the button — and therefore the modal flow — is reachable.
test.describe("Edit Variables modal", () => {
  test.use({ viewport: { width: 800, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("Variables button opens the Edit Variables modal", async ({
    page,
  }) => {
    await page
      .getByRole("toolbar", { name: "Header actions" })
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

  test("Add Variable → Max threads adds a threadCount singleton and hides itself", async ({
    page,
  }) => {
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /max threads/i })
      .click()
    // The card renders the numeric thread-count input.
    await expect(
      dialog.getByText("threadCount variable"),
    ).toBeVisible()
    await expect(
      dialog.getByRole("spinbutton"),
    ).toBeVisible()
    // Re-open the picker: the singleton entry must no longer appear.
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await expect(
      dialog.getByRole("button", { name: /max threads/i }),
    ).toHaveCount(0)
  })

  test("Add Variable → DVD Compare ID creates a dvdCompareId variable", async ({
    page,
  }) => {
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /dvd compare id/i })
      .click()
    await expect(
      dialog.getByText("dvdCompareId variable"),
    ).toBeVisible()
    // No folder browse button: this isn't a path variable.
    await expect(
      dialog.getByTitle(/browse|pick a folder/i),
    ).toHaveCount(0)
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
  // Same as the "Edit Variables modal" suite: need a sub-lg viewport so the
  // header Variables button (which opens the modal) is visible.
  test.use({ viewport: { width: 800, height: 900 } })

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

  test("threadCount variable survives YAML copy-reload", async ({
    page,
  }) => {
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /max threads/i })
      .click()
    await dialog.getByRole("spinbutton").fill("4")

    await dialog
      .getByRole("button", { name: /close/i })
      .click()
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeHidden()

    // Copy YAML.
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

    // The on-disk envelope worker 11 introduced: `tc: { type: threadCount, value: '4' }`.
    expect(yamlText).toContain("tc:")
    expect(yamlText).toContain("threadCount")
    expect(yamlText).toMatch(/value: ['"]?4['"]?/)

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
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeHidden()

    // Re-open modal: the threadCount card is present with the value preserved.
    await openVariablesModal(page)
    await expect(
      page
        .getByRole("dialog")
        .getByText("threadCount variable"),
    ).toBeVisible()
    await expect(
      page.getByRole("dialog").getByRole("spinbutton"),
    ).toHaveValue("4")
  })

  test("dvdCompareId variable survives YAML copy-reload", async ({
    page,
  }) => {
    // Create a dvdCompareId variable via the modal.
    await openVariablesModal(page)
    const dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: /add variable/i })
      .click()
    await dialog
      .getByRole("button", { name: /dvd compare id/i })
      .click()

    // Label + value so toYamlStr emits the variable.
    const labelInput = dialog.getByRole("textbox").first()
    await labelInput.fill("Spider-Man 2002")
    const valueInput = dialog.getByPlaceholder(
      /spider-man-2002 or https/i,
    )
    await valueInput.fill("spider-man-2002")

    await dialog
      .getByRole("button", { name: /close/i })
      .click()
    await expect(
      page.getByRole("dialog", { name: /edit variables/i }),
    ).toBeHidden()

    // Copy YAML.
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

    expect(yamlText).toContain("Spider-Man 2002")
    expect(yamlText).toContain("dvdCompareId")

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
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeHidden()

    // Variable survives reload — both label and type badge are present.
    await openVariablesModal(page)
    await expect(
      page
        .getByRole("dialog")
        .locator("input[value='Spider-Man 2002']"),
    ).toBeVisible()
    await expect(
      page
        .getByRole("dialog")
        .getByText("dvdCompareId variable"),
    ).toBeVisible()
  })
})
