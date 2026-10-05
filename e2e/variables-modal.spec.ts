import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The Edit Variables modal is the Narrow View's editor. At `lg` (1024px)
// and wider the sidebar renders the same panel inline and the modal closes
// itself (EditVariablesModal's `min-width: 1024px` effect), so of the four
// test windows only `narrow` can hold it open. Those suites carry the
// `@narrow-view` tag and the wide windows' claim — the sidebar is the
// editor — carries `@wide-view`; playwright.config.ts routes each tag to the
// windows where it is true.
//
// In the narrow window the header's pinned toolbar is hidden too (≤480px,
// builderStyles.css) and its Variables button is mirrored inside the ⋮
// "Sequence actions" menu, which is where a person on a phone finds it.
async function openVariablesModal(page: Page) {
  await page
    .getByRole("button", { name: "Sequence actions" })
    .click()
  await page
    .locator("#page-actions-controls")
    .getByRole("button", { name: "Variables" })
    .click()
  await expect(
    page.getByRole("dialog", { name: /edit variables/i }),
  ).toBeVisible()
}

// The sidebar is a `Rail`: a column at `md`+ and a strip below the sequence
// in the Narrow View, so it is reachable in every window.
const variablesSidebar = (page: Page) =>
  page.getByRole("complementary", { name: "Variables" })

// ─── Edit Variables modal ─────────────────────────────────────────────────────

test.describe("Edit Variables modal", {
  tag: "@narrow-view",
}, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("Variables in the Sequence actions menu opens the Edit Variables modal", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Sequence actions" })
      .click()
    await page
      .locator("#page-actions-controls")
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
    await page
      .getByRole("menuitem", { name: /^path$/i })
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
    await page
      .getByRole("menuitem", { name: /max threads/i })
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
      page.getByRole("menuitem", {
        name: /max threads/i,
      }),
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
    await page
      .getByRole("menuitem", { name: /dvd compare id/i })
      .click()
    await expect(
      dialog.getByText("dvdCompareId variable"),
    ).toBeVisible()
    // No folder browse button: this isn't a path variable.
    await expect(
      dialog.getByTitle(/browse|pick a folder/i),
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
    await expect(variablesSidebar(page)).toBeVisible()
    await expect(
      variablesSidebar(page).getByRole("heading", {
        name: "Variables",
      }),
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

test.describe("Variables at lg and wider", {
  tag: "@wide-view",
}, () => {
  test("the sidebar is the editor and the header offers no Variables button", async ({
    page,
  }) => {
    await page.goto("/builder/")

    const headerActions = page.getByRole("toolbar", {
      name: "Header actions",
    })
    await expect(headerActions).toBeVisible()
    await expect(
      headerActions.getByRole("button", {
        name: "Variables",
      }),
    ).toBeHidden()
    await expect(
      variablesSidebar(page).getByRole("button", {
        name: /add variable/i,
      }),
    ).toBeVisible()
  })
})

// ─── Variable YAML round-trip ─────────────────────────────────────────────────

// Driven through the sidebar, which every window has, so the round-trip is
// proven in all four. The modal renders the same `VariablesPanel`.
test.describe("Variable YAML round-trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("path variable created in the sidebar survives YAML copy-reload", async ({
    page,
  }) => {
    // Create a path variable in the sidebar.
    const sidebar = variablesSidebar(page)
    await sidebar
      .getByRole("button", { name: /add variable/i })
      .click()
    await page
      .getByRole("menuitem", { name: /^path$/i })
      .click()

    // Give it a label and a value so toYamlStr sees a non-empty variable.
    const labelInput = sidebar.getByRole("textbox").first()
    await labelInput.fill("Media Root")
    const valueInput =
      sidebar.getByPlaceholder(/\/mnt\/media/i)
    await valueInput.fill("/mnt/media")

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

    // The variable survived the reload.
    await expect(
      variablesSidebar(page).locator(
        "input[value='Media Root']",
      ),
    ).toBeVisible()
  })

  test("threadCount variable survives YAML copy-reload", async ({
    page,
  }) => {
    const sidebar = variablesSidebar(page)
    await sidebar
      .getByRole("button", { name: /add variable/i })
      .click()
    await page
      .getByRole("menuitem", { name: /max threads/i })
      .click()
    await sidebar.getByRole("spinbutton").fill("4")

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

    // The threadCount card is back with the value preserved.
    await expect(
      variablesSidebar(page).getByText(
        "threadCount variable",
      ),
    ).toBeVisible()
    await expect(
      variablesSidebar(page).getByRole("spinbutton"),
    ).toHaveValue("4")
  })

  test("dvdCompareId variable survives YAML copy-reload", async ({
    page,
  }) => {
    // Create a dvdCompareId variable in the sidebar.
    const sidebar = variablesSidebar(page)
    await sidebar
      .getByRole("button", { name: /add variable/i })
      .click()
    await page
      .getByRole("menuitem", { name: /dvd compare id/i })
      .click()

    // Label + value so toYamlStr emits the variable.
    const labelInput = sidebar.getByRole("textbox").first()
    await labelInput.fill("Spider-Man 2002")
    const valueInput = sidebar.getByPlaceholder(
      /spider-man-2002 or https/i,
    )
    await valueInput.fill("spider-man-2002")

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
    await expect(
      variablesSidebar(page).locator(
        "input[value='Spider-Man 2002']",
      ),
    ).toBeVisible()
    await expect(
      variablesSidebar(page).getByText(
        "dvdCompareId variable",
      ),
    ).toBeVisible()
  })
})
