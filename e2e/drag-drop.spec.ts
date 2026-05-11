import { expect, type Page, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Encodes YAML as base64 for the ?seq= URL param, matching the builder's
// own URL-state mechanism (Buffer.from(yaml).toString("base64")).
function encodeSeq(yaml: string): string {
  return Buffer.from(yaml, "utf8").toString("base64")
}

async function openControlsMenu(page: Page) {
  await page
    .getByRole("button", { name: "Sequence actions" })
    .click()
}

// Returns the YAML text from the YamlModal, then closes the modal.
async function getYamlText(page: Page): Promise<string> {
  await openControlsMenu(page)
  await page
    .getByRole("button", { name: "View YAML" })
    .click()
  const modal = page.locator("#yaml-modal")
  await expect(modal).toBeVisible()
  const text = await modal.locator("#yaml-out").innerText()
  await page.keyboard.press("Escape")
  return text
}

// ─── Drag-and-drop step reordering ───────────────────────────────────────────

test.describe("Drag-and-drop — step reordering", () => {
  test.beforeEach(async ({ page }) => {
    // Build a two-step sequence via URL: copyFiles → makeDirectory.
    const yaml = [
      "steps:",
      "  - id: step-alpha",
      "    command: copyFiles",
      "    params: {}",
      "  - id: step-beta",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /target",
    ].join("\n")
    const seq = encodeSeq(yaml)
    await page.goto(
      `/builder/?seq=${encodeURIComponent(seq)}`,
    )

    // Wait for both step cards to be in the DOM.
    await expect(page.locator('[id^="step-"]')).toHaveCount(
      2,
    )
  })

  test("drag handle moves step-alpha below step-beta", async ({
    page,
  }) => {
    // Verify initial order: Copy Files first, Make Directory second.
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards.nth(0)).toContainText(
      "Copy Files",
    )
    await expect(stepCards.nth(1)).toContainText(
      "Make Directory",
    )

    // Drag step-alpha's handle to below step-beta's handle.
    const firstHandle = page
      .locator('[id="step-step-alpha"]')
      .locator("[data-drag-handle]")
    const secondHandle = page
      .locator('[id="step-step-beta"]')
      .locator("[data-drag-handle]")

    await firstHandle.dragTo(secondHandle)

    // Allow SortableJS to commit the DOM change.
    await page.waitForTimeout(100)

    // YAML should now reflect the new order: makeDirectory → copyFiles.
    const yamlText = await getYamlText(page)
    const betaIdx = yamlText.indexOf("id: step-beta")
    const alphaIdx = yamlText.indexOf("id: step-alpha")
    expect(betaIdx).toBeGreaterThan(-1)
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(betaIdx).toBeLessThan(alphaIdx)
  })

  test("drag handle moves step-beta above step-alpha", async ({
    page,
  }) => {
    const firstHandle = page
      .locator('[id="step-step-beta"]')
      .locator("[data-drag-handle]")
    const secondHandle = page
      .locator('[id="step-step-alpha"]')
      .locator("[data-drag-handle]")

    await firstHandle.dragTo(secondHandle)
    await page.waitForTimeout(100)

    const yamlText = await getYamlText(page)
    const betaIdx = yamlText.indexOf("id: step-beta")
    const alphaIdx = yamlText.indexOf("id: step-alpha")
    expect(betaIdx).toBeGreaterThan(-1)
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(betaIdx).toBeLessThan(alphaIdx)
  })
})

// ─── Drag-and-drop inside a group ────────────────────────────────────────────

test.describe("Drag-and-drop — inside group", () => {
  test("reorders steps within a parallel group", async ({
    page,
  }) => {
    const yaml = [
      "steps:",
      "  - kind: group",
      "    id: grp-main",
      "    label: Main group",
      "    isParallel: true",
      "    steps:",
      "      - id: inner-first",
      "        command: copyFiles",
      "        params: {}",
      "      - id: inner-second",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /inner",
    ].join("\n")
    const seq = encodeSeq(yaml)
    await page.goto(
      `/builder/?seq=${encodeURIComponent(seq)}`,
    )

    const group = page.locator('[data-group="grp-main"]')
    await expect(group).toBeVisible()

    const innerSteps = group.locator('[id^="step-"]')
    await expect(innerSteps).toHaveCount(2)

    // Verify initial order inside the group.
    await expect(innerSteps.nth(0)).toContainText(
      "Copy Files",
    )
    await expect(innerSteps.nth(1)).toContainText(
      "Make Directory",
    )

    // Drag the first inner step below the second.
    const firstHandle = innerSteps
      .nth(0)
      .locator("[data-drag-handle]")
    const secondHandle = innerSteps
      .nth(1)
      .locator("[data-drag-handle]")

    await firstHandle.dragTo(secondHandle)
    await page.waitForTimeout(100)

    // YAML order inside the group should have flipped.
    const yamlText = await getYamlText(page)
    const firstIdx = yamlText.indexOf("id: inner-first")
    const secondIdx = yamlText.indexOf("id: inner-second")
    expect(firstIdx).toBeGreaterThan(-1)
    expect(secondIdx).toBeGreaterThan(-1)
    expect(secondIdx).toBeLessThan(firstIdx)
  })
})
