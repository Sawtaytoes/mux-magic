import { expect, type Page, test } from "@playwright/test"

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function openControlsMenu(page: Page) {
  await page
    .getByRole("button", { name: "Sequence actions" })
    .click()
}

async function addStepWithCommand(
  page: Page,
  searchTerm: string,
  labelPattern: RegExp,
) {
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
    .fill(searchTerm)
  // Use .first() — the picker may show the same command name in multiple
  // result rows (e.g. search result + recent-use section).
  await page
    .getByRole("button", { name: labelPattern })
    .first()
    .click()
}

// Dispatch a synthetic paste event so LoadModal's clipboard handler fires.
async function pasteText(page: Page, text: string) {
  await page.evaluate((yamlText: string) => {
    const dt = new DataTransfer()
    dt.setData("text/plain", yamlText)
    document.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    )
  }, text)
}

// ─── CommandHelpModal ─────────────────────────────────────────────────────────

test.describe("CommandHelpModal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("ⓘ button opens CommandHelpModal with the command's summary", async ({
    page,
  }) => {
    await addStepWithCommand(
      page,
      "copyFiles",
      /^Copy Files\s/,
    )

    // Click the info button — it appears once a command is selected.
    await page
      .locator(".step-card")
      .first()
      .getByRole("button", {
        name: /Show docs for this command/,
      })
      .click()

    // Modal header identifies the command.
    await expect(
      page.getByText(/Help: Copy Files/),
    ).toBeVisible()

    // At least one field entry should be visible (copyFiles has fields).
    await expect(
      page.getByText("Fields").first(),
    ).toBeVisible()
  })

  test("Escape closes CommandHelpModal", async ({
    page,
  }) => {
    await addStepWithCommand(
      page,
      "copyFiles",
      /^Copy Files\s/,
    )
    await page
      .locator(".step-card")
      .first()
      .getByRole("button", {
        name: /Show docs for this command/,
      })
      .click()
    await expect(
      page.getByText(/Help: Copy Files/),
    ).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(
      page.getByText(/Help: Copy Files/),
    ).toBeHidden()
  })

  test("✕ Close button closes CommandHelpModal", async ({
    page,
  }) => {
    await addStepWithCommand(
      page,
      "copyFiles",
      /^Copy Files\s/,
    )
    await page
      .locator(".step-card")
      .first()
      .getByRole("button", {
        name: /Show docs for this command/,
      })
      .click()
    await expect(
      page.getByText(/Help: Copy Files/),
    ).toBeVisible()

    await page
      .getByRole("button", { name: "✕ Close" })
      .first()
      .click()

    await expect(
      page.getByText(/Help: Copy Files/),
    ).toBeHidden()
  })
})

// ─── LoadModal — builder round-trip ──────────────────────────────────────────

test.describe("LoadModal — builder round-trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("Load YAML button opens LoadModal with paste instructions", async ({
    page,
  }) => {
    // The load button is in the PageHeader with id="load-btn".
    // #load-btn lives inside the responsive controls hamburger menu.
    await openControlsMenu(page)
    await page.locator("#load-btn").click()

    await expect(page.getByText("Load YAML")).toBeVisible()
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeVisible()
  })

  test("pasting YAML into open LoadModal loads the sequence", async ({
    page,
  }) => {
    const yaml = [
      "steps:",
      "  - id: step-load-1",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /test/dir",
    ].join("\n")

    // #load-btn lives inside the responsive controls hamburger menu.
    await openControlsMenu(page)
    await page.locator("#load-btn").click()
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeVisible()

    await pasteText(page, yaml)

    // Modal closes on successful load.
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeHidden()

    // The loaded step card should appear.
    await expect(page.locator('[id^="step-"]')).toHaveCount(
      1,
    )
    await expect(
      page.locator('[id^="step-"]').first(),
    ).toContainText("Make Directory")
  })

  test("round-trip: copy YAML → load → sequence matches", async ({
    page,
  }) => {
    // Build a one-step sequence.
    await addStepWithCommand(
      page,
      "makeDirectory",
      /^Make Directory\s/,
    )

    // Copy YAML from the modal.
    await openControlsMenu(page)
    await page
      .getByRole("button", { name: "View YAML" })
      .click()

    const yamlModal = page.locator("#yaml-modal")
    await expect(yamlModal).toBeVisible()
    const yamlText = await yamlModal
      .locator("#yaml-out")
      .innerText()
    await page.keyboard.press("Escape")

    // Clear the sequence by loading a fresh YAML with the same command.
    // #load-btn lives inside the responsive controls hamburger menu.
    await openControlsMenu(page)
    await page.locator("#load-btn").click()
    await pasteText(page, yamlText)

    // Same step should reappear.
    await expect(page.locator('[id^="step-"]')).toHaveCount(
      1,
    )
    await expect(
      page.locator('[id^="step-"]').first(),
    ).toContainText("Make Directory")
  })

  test("pasting invalid YAML shows an error and keeps modal open", async ({
    page,
  }) => {
    // #load-btn lives inside the responsive controls hamburger menu.
    await openControlsMenu(page)
    await page.locator("#load-btn").click()
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeVisible()

    await pasteText(page, ": : : this is invalid yaml :::")

    // Error alert should appear.
    await expect(page.getByRole("alert")).toBeVisible()
    // Modal stays open.
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeVisible()
  })

  test("Escape closes LoadModal without loading", async ({
    page,
  }) => {
    // #load-btn lives inside the responsive controls hamburger menu.
    await openControlsMenu(page)
    await page.locator("#load-btn").click()
    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(
      page.getByText(/Paste your saved sequence YAML/),
    ).toBeHidden()
    // Empty state remains — nothing was loaded.
    await expect(
      page.getByText(/No steps yet/),
    ).toBeVisible()
  })
})

// ─── LookupModal ─────────────────────────────────────────────────────────────

test.describe("LookupModal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("🔍 button on a NumberWithLookupField opens LookupModal", async ({
    page,
  }) => {
    // nameAnimeEpisodes has a malId field with lookupType "mal".
    await addStepWithCommand(
      page,
      "nameAnimeEpisodes",
      /^Name Anime Episodes \(MAL\)/,
    )

    await page
      .getByRole("button", { name: /Look up/ })
      .first()
      .click()

    await expect(
      page.locator("#lookup-modal"),
    ).toBeVisible()
    // Title reflects the lookup type.
    await expect(page.locator("#lookup-title")).toHaveText(
      "Look up MAL ID",
    )
    // Search stage shows a search input.
    await expect(
      page.locator("#lookup-body").getByRole("textbox"),
    ).toBeVisible()
  })

  test("Escape closes LookupModal", async ({ page }) => {
    await addStepWithCommand(
      page,
      "nameAnimeEpisodes",
      /^Name Anime Episodes \(MAL\)/,
    )
    await page
      .getByRole("button", { name: /Look up/ })
      .first()
      .click()
    await expect(
      page.locator("#lookup-modal"),
    ).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(page.locator("#lookup-modal")).toBeHidden()
  })

  test("✕ button closes LookupModal", async ({ page }) => {
    await addStepWithCommand(
      page,
      "nameAnimeEpisodes",
      /^Name Anime Episodes \(MAL\)/,
    )
    await page
      .getByRole("button", { name: /Look up/ })
      .first()
      .click()
    await expect(
      page.locator("#lookup-modal"),
    ).toBeVisible()

    await page
      .locator("#lookup-modal")
      .getByRole("button", { name: "✕" })
      .click()

    await expect(page.locator("#lookup-modal")).toBeHidden()
  })
})

// ─── FileExplorerModal ────────────────────────────────────────────────────────

test.describe("FileExplorerModal", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the file listing so the test doesn't touch the real filesystem.
    await page.route("**/files/list*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [
            {
              name: "Anime",
              isDirectory: true,
              isFile: false,
              size: 0,
              mtime: null,
              duration: null,
            },
            {
              name: "Movies",
              isDirectory: true,
              isFile: false,
              size: 0,
              mtime: null,
              duration: null,
            },
          ],
          separator: "/",
        }),
      })
    })

    await page.route(
      "**/files/delete-mode*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ mode: "trash" }),
        })
      },
    )

    await page.goto("/builder/")
  })

  test("Browse folders button opens FileExplorerModal in picker mode", async ({
    page,
  }) => {
    await page.route(
      "**/queries/listDirectoryEntries",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entries: [],
            separator: "/",
            error: null,
          }),
        })
      },
    )

    // storeAspectRatioData has a FolderMultiSelectField.
    await addStepWithCommand(
      page,
      "storeAspectRatioData",
      /^Store Aspect Ratio Data\s/,
    )

    const stepCard = page.locator(".step-card").first()
    const sourceInput = stepCard.locator(
      "input[data-field='sourcePath']",
    )
    await sourceInput.focus()
    await sourceInput.fill("G:\\TestPath")
    await sourceInput.press("Escape")
    await sourceInput.blur()

    await stepCard
      .getByRole("button", { name: /Browse folders/ })
      .first()
      .click()

    await expect(
      page.locator("#file-explorer-modal"),
    ).toBeVisible()
    // Picker mode badge confirms it's in picker mode.
    await expect(
      page.locator("#file-explorer-picker-badge"),
    ).toBeVisible()
    await expect(
      page.locator("#file-explorer-picker-badge"),
    ).toHaveText("PICKER")
  })

  test("FileExplorerModal lists directory entries from the stub", async ({
    page,
  }) => {
    await page.route(
      "**/queries/listDirectoryEntries",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entries: [],
            separator: "/",
            error: null,
          }),
        })
      },
    )

    await addStepWithCommand(
      page,
      "storeAspectRatioData",
      /^Store Aspect Ratio Data\s/,
    )
    const stepCard = page.locator(".step-card").first()
    const sourceInput = stepCard.locator(
      "input[data-field='sourcePath']",
    )
    await sourceInput.focus()
    await sourceInput.fill("G:\\TestPath")
    await sourceInput.press("Escape")
    await sourceInput.blur()

    await stepCard
      .getByRole("button", { name: /Browse folders/ })
      .first()
      .click()

    await expect(
      page.locator("#file-explorer-modal"),
    ).toBeVisible()

    // Stub response has "Anime" and "Movies" folders.
    await expect(
      page
        .locator("#file-explorer-body")
        .getByText("Anime"),
    ).toBeVisible()
    await expect(
      page
        .locator("#file-explorer-body")
        .getByText("Movies"),
    ).toBeVisible()
  })

  test("✕ button closes FileExplorerModal", async ({
    page,
  }) => {
    await page.route(
      "**/queries/listDirectoryEntries",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entries: [],
            separator: "/",
            error: null,
          }),
        })
      },
    )

    await addStepWithCommand(
      page,
      "storeAspectRatioData",
      /^Store Aspect Ratio Data\s/,
    )
    const stepCard = page.locator(".step-card").first()
    const sourceInput = stepCard.locator(
      "input[data-field='sourcePath']",
    )
    await sourceInput.focus()
    await sourceInput.fill("G:\\TestPath")
    await sourceInput.press("Escape")
    await sourceInput.blur()

    await stepCard
      .getByRole("button", { name: /Browse folders/ })
      .first()
      .click()
    await expect(
      page.locator("#file-explorer-modal"),
    ).toBeVisible()

    await page
      .locator("#file-explorer-modal")
      .getByTitle("Close")
      .click()

    await expect(
      page.locator("#file-explorer-modal"),
    ).toBeHidden()
  })
})
