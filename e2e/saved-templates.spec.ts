import { expect, test } from "@playwright/test"

import { apiBaseUrl } from "./playwright.setup.js"

// Saved Templates sidebar — save / reload / load round-trip.
//
// Templates persist server-side via /api/templates (worker 2a). This
// spec confirms the full cycle: type a step, save as a named template,
// reload the page, see the template still listed, load it back, and
// see the same step reappear.
//
// The sidebar is desktop-only (`hidden lg:flex`), so this spec sticks
// to the default Playwright viewport which is well above the `lg`
// breakpoint.

test.describe("Saved Templates sidebar", () => {
  // Best-effort cleanup of any leftover templates from prior runs that
  // happened to reuse the same APP_DATA_DIR. The worker-port/PID
  // protocol in AGENTS.md fabricates a fresh tmpdir per session, so
  // the loop is a no-op on the first run, but it keeps the spec
  // re-runnable in dev without the launcher dance — the first
  // assertion below depends on "No saved templates yet." being
  // visible. The api lives on its own origin (PORT, not WEB_PORT),
  // hence the absolute URL — `page.request.get("/api/templates")`
  // would resolve against the web baseURL and the SPA's index.html
  // fallback would return non-JSON.
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
    const listResponse = await page.request.get(
      `${apiBaseUrl}/api/templates`,
    )
    if (listResponse.ok()) {
      const body = (await listResponse.json()) as {
        templates: { id: string }[]
      }
      await Promise.all(
        body.templates.map((template) =>
          page.request.delete(
            `${apiBaseUrl}/api/templates/${template.id}`,
          ),
        ),
      )
    }
    await page.reload()
  })

  test("save current → reload page → template still listed → load restores it", async ({
    page,
  }) => {
    const sidebar = page.getByRole("complementary", {
      name: "Variables",
    })
    const section = sidebar.getByRole("region", {
      name: "Saved Templates",
    })
    await expect(section).toBeVisible()
    await expect(
      section.getByText("No saved templates yet."),
    ).toBeVisible()

    // Need at least one step in the sequence — toYamlStr returns the
    // comment "# No steps yet" for an empty sequence, which the server's
    // validator (correctly) rejects as not a valid template body.
    await page
      .getByRole("button", { name: "➕ Step" })
      .first()
      .click()

    // Open the save modal and submit a uniquely-named template.
    await section
      .getByRole("button", { name: "Save current" })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Save sequence as template",
    })
    await expect(dialog).toBeVisible()
    const templateName = `e2e Workflow ${Date.now()}`
    await dialog
      .getByPlaceholder("My workflow")
      .fill(templateName)
    await dialog
      .getByRole("button", { name: "Save" })
      .click()
    await expect(dialog).toBeHidden({ timeout: 5_000 })

    // Row appears in the sidebar.
    await expect(
      section.getByRole("button", { name: templateName }),
    ).toBeVisible()

    // Reload — server-backed list survives.
    await page.reload()
    const refreshedSection = page
      .getByRole("complementary", { name: "Variables" })
      .getByRole("region", { name: "Saved Templates" })
    await expect(
      refreshedSection.getByRole("button", {
        name: templateName,
      }),
    ).toBeVisible()

    // Click the template to load it — undo toast appears.
    await refreshedSection
      .getByRole("button", { name: templateName })
      .click()
    await expect(
      refreshedSection.getByRole("status"),
    ).toContainText(/Loaded template/)

    // Clean up: delete the template so subsequent runs see an empty list.
    page.on("dialog", (confirm) => confirm.accept())
    await refreshedSection
      .getByRole("listitem")
      .filter({ hasText: templateName })
      .getByRole("button", { name: "Delete" })
      .click()
    await expect(
      refreshedSection.getByText("No saved templates yet."),
    ).toBeVisible()
  })
})
