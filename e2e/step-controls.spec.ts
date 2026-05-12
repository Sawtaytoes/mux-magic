import { expect, test } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeSeq(yaml: string): string {
  return Buffer.from(yaml, "utf8").toString("base64")
}

// ─── Step controls — play/stop ────────────────────────────────────────────────

test.describe("Step controls — play/stop", () => {
  test("▶ Run button is disabled when no command is selected", async ({
    page,
  }) => {
    await page.goto("/builder/")

    // Add an empty step (no command).
    await page
      .getByRole("button", { name: "➕ Step" })
      .last()
      .click()

    const stepCard = page.locator(".step-card").first()
    await expect(
      stepCard.getByRole("button", {
        name: "Run this step only",
      }),
    ).toBeDisabled()
  })

  test("▶ Run button is enabled once a command is selected", async ({
    page,
  }) => {
    const yaml = encodeSeq(
      [
        "steps:",
        "  - id: step-a",
        "    command: makeDirectory",
        "    params:",
        "      filePath: /tmp/test",
      ].join("\n"),
    )
    await page.goto(`/builder/?seq=${yaml}`)

    const stepCard = page.locator(".step-card").first()
    await expect(
      stepCard.getByRole("button", {
        name: "Run this step only",
      }),
    ).toBeEnabled()
  })
})

// ─── Step controls — up/down reorder ─────────────────────────────────────────

test.describe("Step controls — up/down reorder", () => {
  test.beforeEach(async ({ page }) => {
    const yaml = encodeSeq(
      [
        "steps:",
        "  - id: step-alpha",
        "    command: copyFiles",
        "    params: {}",
        "  - id: step-beta",
        "    command: makeDirectory",
        "    params:",
        "      filePath: /tmp/test",
      ].join("\n"),
    )
    await page.goto(`/builder/?seq=${yaml}`)
  })

  test("↑ button is disabled for the first step", async ({
    page,
  }) => {
    const firstCard = page.locator(".step-card").first()
    await expect(
      firstCard.getByRole("button", {
        name: "Move step up",
      }),
    ).toBeDisabled()
  })

  test("↓ button is disabled for the last step", async ({
    page,
  }) => {
    const lastCard = page.locator(".step-card").last()
    await expect(
      lastCard.getByRole("button", {
        name: "Move step down",
      }),
    ).toBeDisabled()
  })

  test("↓ on first step moves it below the second", async ({
    page,
  }) => {
    // Before: step-alpha(1 — Copy Files), step-beta(2 — Make Directory).
    await page
      .locator(".step-card")
      .first()
      .getByRole("button", { name: "Move step down" })
      .click()

    // After: step-beta(1 — Make Directory), step-alpha(2 — Copy Files).
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Make Directory")
    await expect(
      page.locator(".step-card").last(),
    ).toContainText("Copy Files")
  })

  test("↑ on second step moves it above the first", async ({
    page,
  }) => {
    // Before: step-alpha(1 — Copy Files), step-beta(2 — Make Directory).
    await page
      .locator(".step-card")
      .nth(1)
      .getByRole("button", { name: "Move step up" })
      .click()

    // After: step-beta(1 — Make Directory), step-alpha(2 — Copy Files).
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Make Directory")
    await expect(
      page.locator(".step-card").last(),
    ).toContainText("Copy Files")
  })
})

// ─── Step controls — delete ✕ ────────────────────────────────────────────────

test.describe("Step controls — delete", () => {
  test.beforeEach(async ({ page }) => {
    const yaml = encodeSeq(
      [
        "steps:",
        "  - id: step-alpha",
        "    command: copyFiles",
        "    params: {}",
        "  - id: step-beta",
        "    command: makeDirectory",
        "    params:",
        "      filePath: /tmp/test",
      ].join("\n"),
    )
    await page.goto(`/builder/?seq=${yaml}`)
  })

  test("✕ removes the step and decrements count", async ({
    page,
  }) => {
    await expect(page.locator(".step-card")).toHaveCount(2)

    await page
      .locator(".step-card")
      .first()
      .getByRole("button", { name: "Remove this step" })
      .click()

    await expect(page.locator(".step-card")).toHaveCount(1)
  })

  test("✕ removes the correct step", async ({ page }) => {
    // Delete the first step (Copy Files); only Make Directory should remain.
    await page
      .locator(".step-card")
      .first()
      .getByRole("button", { name: "Remove this step" })
      .click()

    await expect(page.locator(".step-card")).toHaveCount(1)
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Make Directory")
  })
})

// ─── Step controls — paste 📋 ─────────────────────────────────────────────────
// Paste reads from the system clipboard (navigator.clipboard.readText) so the
// tests write YAML directly to the clipboard via page.evaluate and grant the
// clipboard-read permission on the browser context.

const PASTE_YAML = [
  "steps:",
  "  - id: step-pasted",
  "    command: deleteFilesByExtension",
  "    params: {}",
].join("\n")

test.describe("Step controls — paste", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read"])

    const yaml = encodeSeq(
      [
        "steps:",
        "  - id: step-alpha",
        "    command: copyFiles",
        "    params: {}",
        "  - id: step-beta",
        "    command: makeDirectory",
        "    params:",
        "      filePath: /tmp/test",
      ].join("\n"),
    )
    await page.goto(`/builder/?seq=${yaml}`)

    // Pre-load clipboard with a valid step YAML.
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      PASTE_YAML,
    )
  })

  test("📋 paste at top inserts card as first step", async ({
    page,
  }) => {
    await page
      .getByTitle("Paste a copied step or group here")
      .first()
      .click()

    await expect(page.locator(".step-card")).toHaveCount(3)
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Delete Files by Extension")
    // Original cards follow in order.
    await expect(
      page.locator(".step-card").nth(1),
    ).toContainText("Copy Files")
    await expect(
      page.locator(".step-card").last(),
    ).toContainText("Make Directory")
  })

  test("📋 paste between cards inserts at correct position", async ({
    page,
  }) => {
    // Dividers: [0]=before first, [1]=between cards, [2]=after last.
    await page
      .getByTitle("Paste a copied step or group here")
      .nth(1)
      .click()

    await expect(page.locator(".step-card")).toHaveCount(3)
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Copy Files")
    await expect(
      page.locator(".step-card").nth(1),
    ).toContainText("Delete Files by Extension")
    await expect(
      page.locator(".step-card").last(),
    ).toContainText("Make Directory")
  })

  test("📋 paste at bottom inserts card as last step", async ({
    page,
  }) => {
    await page
      .getByTitle("Paste a copied step or group here")
      .last()
      .click()

    await expect(page.locator(".step-card")).toHaveCount(3)
    await expect(
      page.locator(".step-card").last(),
    ).toContainText("Delete Files by Extension")
    // Original order is preserved above it.
    await expect(
      page.locator(".step-card").first(),
    ).toContainText("Copy Files")
    await expect(
      page.locator(".step-card").nth(1),
    ).toContainText("Make Directory")
  })
})
