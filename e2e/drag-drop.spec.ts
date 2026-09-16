import {
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test"

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

// Reorder with dnd-kit's KeyboardSensor rather than a synthetic mouse drag.
// A pointer drag only swaps once the pointer crosses the TARGET's midpoint,
// and Playwright's `dragTo` releases at the target's centre — exactly that
// boundary. It therefore reorders in one direction and not the other, which
// is what left these tests skipped. The keyboard path has no geometry in it:
// the drag handle is a real button carrying dnd-kit's activator attributes
// and `sortableKeyboardCoordinates`, so Space lifts, an arrow key moves one
// position, and Space drops.
async function moveStepWithKeyboard(
  page: Page,
  dragHandle: Locator,
  direction: "down" | "up",
) {
  await dragHandle.focus()
  // dnd-kit measures the droppables on lift and again after each move, both
  // on the next frame. Three key presses in the same tick outrun that and
  // the drag never leaves its start position, so each step waits.
  await page.keyboard.press("Space")
  await page.waitForTimeout(150)
  await page.keyboard.press(
    direction === "down" ? "ArrowDown" : "ArrowUp",
  )
  await page.waitForTimeout(150)
  await page.keyboard.press("Space")
  await page.waitForTimeout(150)
}

// ─── Drag-and-drop step reordering ───────────────────────────────────────────

test.describe("Drag-and-drop — step reordering", () => {
  // `[data-step-card]` is the card's own marker. `[id^="step-"]` — what this
  // suite used to select on — also matches the list container `#steps-el`
  // and the other step-prefixed ids on the page.
  const stepCards = (page: Page) =>
    page.locator("[data-step-card]")

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
    await expect(stepCards(page)).toHaveCount(2)
    await expect(stepCards(page).nth(0)).toContainText(
      "Copy Files",
    )
    await expect(stepCards(page).nth(1)).toContainText(
      "Make Directory",
    )
  })

  test("drag handle moves step-alpha below step-beta", async ({
    page,
  }) => {
    const alphaHandle = page
      .locator('[data-step-card="step-alpha"]')
      .locator("[data-drag-handle]")

    await moveStepWithKeyboard(page, alphaHandle, "down")

    // Assert on the DOM first — it retries, where a fixed wait for
    // dnd-kit's drop animation races the YAML read that follows.
    await expect(stepCards(page).nth(0)).toContainText(
      "Make Directory",
    )
    await expect(stepCards(page).nth(1)).toContainText(
      "Copy Files",
    )

    // YAML should now reflect the new order: makeDirectory → copyFiles.
    const yamlText = await getYamlText(page)
    const betaIndex = yamlText.indexOf("id: step-beta")
    const alphaIndex = yamlText.indexOf("id: step-alpha")
    expect(betaIndex).toBeGreaterThan(-1)
    expect(alphaIndex).toBeGreaterThan(-1)
    expect(betaIndex).toBeLessThan(alphaIndex)
  })

  test("drag handle moves step-beta above step-alpha", async ({
    page,
  }) => {
    const betaHandle = page
      .locator('[data-step-card="step-beta"]')
      .locator("[data-drag-handle]")

    await moveStepWithKeyboard(page, betaHandle, "up")

    await expect(stepCards(page).nth(0)).toContainText(
      "Make Directory",
    )
    await expect(stepCards(page).nth(1)).toContainText(
      "Copy Files",
    )

    const yamlText = await getYamlText(page)
    const betaIndex = yamlText.indexOf("id: step-beta")
    const alphaIndex = yamlText.indexOf("id: step-alpha")
    expect(betaIndex).toBeGreaterThan(-1)
    expect(alphaIndex).toBeGreaterThan(-1)
    expect(betaIndex).toBeLessThan(alphaIndex)
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

    const innerSteps = group.locator("[data-step-card]")
    await expect(innerSteps).toHaveCount(2)

    // Verify initial order inside the group.
    await expect(innerSteps.nth(0)).toContainText(
      "Copy Files",
    )
    await expect(innerSteps.nth(1)).toContainText(
      "Make Directory",
    )

    // Move the first inner step below the second.
    const firstHandle = innerSteps
      .nth(0)
      .locator("[data-drag-handle]")

    await moveStepWithKeyboard(page, firstHandle, "down")

    await expect(innerSteps.nth(0)).toContainText(
      "Make Directory",
    )
    await expect(innerSteps.nth(1)).toContainText(
      "Copy Files",
    )

    // YAML order inside the group should have flipped.
    const yamlText = await getYamlText(page)
    const firstIndex = yamlText.indexOf("id: inner-first")
    const secondIndex = yamlText.indexOf("id: inner-second")
    expect(firstIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeLessThan(firstIndex)
  })
})
