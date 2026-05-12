import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addModifySubtitleMetadataStep(page: Page) {
  const emptyState = page.getByRole("button", {
    name: /Add your first step/,
  })
  if (await emptyState.isVisible()) {
    await emptyState.click()
  } else {
    await page
      .getByRole("button", { name: /^➕ Step$/ })
      .last()
      .click()
  }
  await page.getByText("— pick a command —").last().click()
  await page
    .getByPlaceholder("Search commands…")
    .fill("modifySubtitleMetadata")
  await page
    .getByRole("button", {
      name: /^Modify Subtitle Metadata\s/,
    })
    .click()
}

// ─── DslRulesBuilder — full lifecycle ────────────────────────────────────────

test.describe("DslRulesBuilder — rule lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
    await addModifySubtitleMetadataStep(page)
  })

  test("adding a setScriptInfo rule creates a rule card", async ({
    page,
  }) => {
    const initialCount = await page
      .locator("[data-rule-key]")
      .count()

    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    await expect(
      page.locator("[data-rule-key]"),
    ).toHaveCount(initialCount + 1)
  })

  test("adding multiple rule types creates multiple cards", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()
    await page
      .getByRole("button", { name: "+ scaleResolution" })
      .first()
      .click()

    await expect(
      page.locator("[data-rule-key]"),
    ).toHaveCount(2)
  })

  test("rule details panel expands and stays open after interaction", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    // Find the first rule card's details panel.
    const ruleCard = page.locator("[data-rule-key]").first()
    const detailsPanel = ruleCard.locator("details").first()
    await detailsPanel.locator("summary").click()
    await expect(detailsPanel).toHaveAttribute("open")

    // Interact with something inside (type in a text field if present).
    const textInputs = detailsPanel.locator(
      'input[type="text"], input[type="number"]',
    )
    const inputCount = await textInputs.count()
    if (inputCount > 0) {
      await textInputs.first().fill("test-value")
    }

    // Panel must still be open after the interaction.
    await expect(detailsPanel).toHaveAttribute("open")
  })

  test("removing a rule card decrements the rule count", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()
    await expect(
      page.locator("[data-rule-key]"),
    ).toHaveCount(1)

    // Each rule card has a remove button.
    await page
      .locator("[data-rule-key]")
      .first()
      .getByRole("button", { name: /Remove|✕|×|delete/i })
      .click()

    await expect(
      page.locator("[data-rule-key]"),
    ).toHaveCount(0)
  })

  test("predicates panel adds a predicate entry and stays open", async ({
    page,
  }) => {
    const predicatesDetails = page.locator(
      "[data-details-key$=':predicates']",
    )
    await predicatesDetails
      .getByRole("button", { name: /predicates/i })
      .click()
    const addPredicateBtn = predicatesDetails.getByRole(
      "button",
      { name: "+ Add predicate" },
    )
    await expect(addPredicateBtn).toBeVisible()

    await addPredicateBtn.click()

    await expect(addPredicateBtn).toBeVisible()
    // At least one predicate entry should now exist.
    await expect(
      predicatesDetails.locator("[data-predicate-key]"),
    ).toHaveCount(1)
  })

  test("rule mutations persist in YAML output", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    // Open the sequence actions to view YAML.
    await page
      .getByRole("button", { name: "Sequence actions" })
      .click()
    await page
      .getByRole("button", { name: "View YAML" })
      .click()

    const yamlModal = page.locator("#yaml-modal")
    await expect(yamlModal).toBeVisible()

    // The YAML should contain the rule type we added.
    await expect(
      yamlModal.locator("#yaml-out"),
    ).toContainText("setScriptInfo")
  })
})

// ─── DslRulesBuilder — When panel ────────────────────────────────────────────

test.describe("DslRulesBuilder — When panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
    await addModifySubtitleMetadataStep(page)
  })

  test("When panel opens and a condition type can be selected", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    const whenDetails = page.locator(
      "[data-details-key$=':when:0']",
    )
    await whenDetails.locator("summary").click()
    const conditionSelect = whenDetails.getByRole("combobox", {
      name: "Condition type",
    })
    await expect(conditionSelect).toBeVisible()

    // Select a condition from the dropdown. selectOption resolving without
    // timeout proves the select was open and clickable. The mutation's
    // side-effect (the clause appears as a WhenClauseRow header) is the
    // user-visible outcome we care about.
    await conditionSelect.selectOption("anyScriptInfo")

    // The new clause renders a header span with the clause name.
    // We locate the rule card root rather than scoping inside the details
    // because the React-controlled <details>'s `open` attribute is lost on
    // re-render, making children appear "hidden" to Playwright even when
    // they are in the DOM.
    await expect(
      page
        .locator("[data-rule-key]")
        .first()
        .locator("text=anyScriptInfo"),
    ).toBeAttached()
  })
})

// ─── DslRulesBuilder — scaleResolution ───────────────────────────────────────

test.describe("DslRulesBuilder — scaleResolution", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
    await addModifySubtitleMetadataStep(page)
  })

  test("scaleResolution width input retains focus while typing", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ scaleResolution" })
      .first()
      .click()

    const widthInput = page
      .getByRole("spinbutton", { name: "From width" })
      .first()
    await widthInput.click()
    await expect(widthInput).toBeFocused()

    await widthInput.pressSequentially("1920")
    await expect(widthInput).toBeFocused()
    await expect(widthInput).toHaveValue("1920")
  })
})
