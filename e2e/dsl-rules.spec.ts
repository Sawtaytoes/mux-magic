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
    .getByRole("option", {
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

    // The disclosure is an `Accordion` now, not a `<details>`, so the state
    // is `aria-expanded` on the trigger rather than an `open` attribute on
    // the element — which is the same fact said in a way assistive
    // technology can read.
    const ruleCard = page.locator("[data-rule-key]").first()
    const trigger = ruleCard
      .getByRole("button", { name: /^When \(advanced/ })
      .first()
    await trigger.click()
    await expect(trigger).toHaveAttribute(
      "aria-expanded",
      "true",
    )

    const panel = ruleCard.getByRole("group", {
      name: /^When \(advanced/,
    })
    await expect(panel).toBeVisible()

    // Interact with something inside (type in a text field if present).
    const textInputs = panel.locator(
      'input[type="text"], input[type="number"]',
    )
    const inputCount = await textInputs.count()
    if (inputCount > 0) {
      await textInputs.first().fill("test-value")
    }

    // Still open after the interaction. This test was written because the
    // React-controlled `<details>` used to lose `open` on re-render — two
    // owners for one fact. The accordion holds it alone.
    await expect(trigger).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    await expect(panel).toBeVisible()
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
    // Reached by the trigger's accessible name — the `data-details-key`
    // handle went with the `Accordion` migration.
    await page
      .getByRole("button", { name: /^Predicates \(/ })
      .first()
      .click()
    const predicatesPanel = page.getByRole("group", {
      name: /^Predicates \(/,
    })
    const addPredicateBtn = predicatesPanel.getByRole(
      "button",
      { name: "+ Add predicate" },
    )
    await expect(addPredicateBtn).toBeVisible()

    await addPredicateBtn.click()

    await expect(addPredicateBtn).toBeVisible()
    // At least one predicate entry should now exist.
    await expect(
      predicatesPanel.locator("[data-predicate-key]"),
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

  test("When panel opens and a group's combinator can be chosen", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    // The `When` disclosure is an `Accordion`, not a `<details>`, so it
    // is reached by the trigger's accessible name rather than by a
    // `data-details-key` handle only this file could see.
    await page
      .getByRole("button", { name: /^When \(advanced/ })
      .first()
      .click()

    // There is no "+ Add clause…" select any more. A `when:` is a tree,
    // and a group's combinator is two pickers: the quantifier, and what
    // it ranges over. Both are `Listbox` triggers — buttons that open a
    // listbox — named "<label>: <current value>" so the visible text
    // stays inside the accessible name.
    const quantifier = page
      .getByRole("button", { name: /^Quantifier: / })
      .first()
    await expect(quantifier).toBeVisible()

    const target = page
      .getByRole("button", { name: /^Target: / })
      .first()
    await expect(target).toBeVisible()

    // NOT ALL is the case the second picker exists for: the DSL declares
    // `notAllScriptInfo` and no `notAllStyle`, so choosing it must leave
    // exactly one legal target rather than offering a pair that cannot
    // be written out.
    await quantifier.click()
    await page
      .getByRole("option", { name: "NOT ALL" })
      .click()

    await expect(
      page
        .getByRole("button", { name: /^Target: / })
        .first(),
    ).toHaveAccessibleName("Target: script info")

    await page
      .getByRole("button", { name: /^Target: / })
      .first()
      .click()

    // Scoped to the open listbox: every picker on the page renders its
    // own options with role "option", and only one panel is open.
    await expect(
      page.getByRole("listbox").getByRole("option"),
    ).toHaveCount(1)
  })

  test("a condition can be added to a group", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "+ setScriptInfo" })
      .first()
      .click()

    await page
      .getByRole("button", { name: /^When \(advanced/ })
      .first()
      .click()

    await expect(
      page.getByRole("textbox", { name: "Condition key" }),
    ).toHaveCount(0)

    await page
      .getByRole("button", { name: "+ Condition" })
      .first()
      .click()

    await expect(
      page
        .getByRole("textbox", { name: "Condition key" })
        .first(),
    ).toBeVisible()
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
