import { expect, test, type Page } from "@playwright/test"

// Adds a step to the builder via whichever affordance is currently
// available: the empty-state "Add your first step" button when no steps
// exist, or the trailing per-divider "+ Step" button when there are.
// The header no longer carries an "Add Step" button — the per-divider
// buttons cover insert-anywhere and the empty-state button covers the
// from-scratch path.
async function addStep(page: Page) {
  const emptyState = page.getByRole("button", { name: /Add your first step/ })
  if (await emptyState.isVisible().catch(() => false)) {
    await emptyState.click()
    return
  }
  // Many "+ Step" buttons (one per divider). The trailing one always
  // appends, mirroring the old header-button semantics.
  const stepButtons = page.getByRole("button", { name: /^➕ Step$/ })
  await stepButtons.last().click()
}

test.describe("Sequence Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Bare URL — no ?seq= param so we always start with a fresh, empty
    // builder regardless of what the previous test left behind.
    await page.goto("/builder/")
  })

  test("renders the header and the empty-state hint", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sequence Builder" })).toBeVisible()
    // Header actions: "Add Step / Add Group / Add Parallel Group" no
    // longer live in the header — the per-divider buttons cover those
    // (and the empty-state button covers the from-scratch path).
    await expect(page.getByRole("button", { name: "Add Path" })).toBeVisible()
    await expect(page.getByRole("button", { name: "▶ Run Sequence" })).toBeVisible()
    // Empty-state copy + its inline "Add your first step" button.
    await expect(page.getByText(/No steps yet/)).toBeVisible()
    await expect(page.getByRole("button", { name: /Add your first step/ })).toBeVisible()
  })

  test("Add Step inserts an empty step card with the command picker", async ({ page }) => {
    await addStep(page)
    // Empty step's trigger button shows the placeholder label.
    await expect(page.getByText("— pick a command —")).toBeVisible()
    // The hint disappears once a step exists.
    await expect(page.getByText(/No steps yet/)).toBeHidden()
  })

  test("command picker filters by name and selects on click", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()

    // Picker appears with focused search input.
    const search = page.getByPlaceholder("Search commands…")
    await expect(search).toBeFocused()

    // Filtering by "copy" should show copyFiles + copyOutSubtitles + flattenOutput's tag... actually only commands whose name OR tag matches "copy".
    await search.fill("copy")
    await expect(page.getByRole("button", { name: /^Copy Files\s/ })).toBeVisible()

    // Click the copyFiles entry → picker closes, step shows the command name.
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()
    await expect(search).toBeHidden()
    // The trigger now shows copyFiles instead of the placeholder.
    await expect(page.getByText("— pick a command —")).toBeHidden()
  })

  test("View YAML icon opens the modal showing the current sequence", async ({ page }) => {
    // Add a step so the YAML has content.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    await page.getByRole("button", { name: "View YAML" }).click()

    const modal = page.locator("#yaml-modal")
    await expect(modal).toBeVisible()
    await expect(modal.locator("#yaml-out")).toContainText("command: copyFiles")
  })

  test("path typeahead pulls from /queries/listDirectoryEntries and completes on click", async ({ page }) => {
    // Stub the directory listing so the test doesn't depend on the host's filesystem.
    await page.route("**/queries/listDirectoryEntries", async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() ?? "{}")
      // Server reports its native separator regardless of input; use forward
      // slash so the test is host-agnostic.
      const entries = body.path === "/"
        ? [
            { name: "mnt", isDirectory: true },
            { name: "var", isDirectory: true },
            { name: "tmp", isDirectory: true },
          ]
        : body.path === "/mnt" || body.path === "/mnt/"
        ? [
            { name: "media", isDirectory: true },
            { name: "data", isDirectory: true },
          ]
        : []
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries, separator: "/", error: null }),
      })
    })

    // Use the Base Path's value input — a path-variable card always renders
    // a writable input (no auto-link to a step output, no readonly state).
    // Step path fields end up read-only when they auto-link to a path
    // variable on creation, so the manual-input is hidden by default.
    // The path-var card now has two text inputs (label + value); match
    // the value input by its placeholder so we don't accidentally grab
    // the editable name field.
    const basePathInput = page.locator('[data-path-var]').first().locator('input[placeholder*="/mnt/media"]')

    await basePathInput.fill("/")
    await expect(page.locator("#path-picker-popover")).toBeVisible()
    await expect(page.getByRole("button", { name: /^📁 mnt$/ })).toBeVisible()

    // Click "mnt" → drill into mnt/, picker reopens for /mnt.
    await page.getByRole("button", { name: /^📁 mnt$/ }).click()
    await expect(basePathInput).toHaveValue("/mnt/")
    await expect(page.getByRole("button", { name: /^📁 media$/ })).toBeVisible()

    // Esc commits the parent directory by stripping the trailing slash.
    await basePathInput.press("Escape")
    await expect(page.locator("#path-picker-popover")).toBeHidden()
    await expect(basePathInput).toHaveValue("/mnt")
  })

  test("Add Path creates a new path-variable card whose value lands in the YAML", async ({ page }) => {
    await page.getByRole("button", { name: "Add Path" }).click()

    // Two path-var cards exist now: Base Path + Path 1.
    const pathVarCards = page.locator("[data-path-var]")
    await expect(pathVarCards).toHaveCount(2)

    // Fill the new card's value input — last input is the value (label is first).
    const newPathValueInput = pathVarCards.nth(1).locator('input').last()
    await newPathValueInput.fill("/data/anime")
    await newPathValueInput.blur()

    // YAML modal should reflect the new path's value.
    await page.getByRole("button", { name: "View YAML" }).click()
    await expect(page.locator("#yaml-out")).toContainText("/data/anime")
  })

  test("step reorder via the up arrow swaps adjacent steps", async ({ page }) => {
    // Two distinct steps so we can tell them apart by command name.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^Move Files\s/ }).click()

    // Order is now [copyFiles, moveFiles]. Move moveFiles up via its ↑.
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(2)
    await stepCards.nth(1).getByRole("button", { name: "↑" }).click()

    // First card should now be moveFiles.
    await expect(stepCards.nth(0)).toContainText("Move Files")
    await expect(stepCards.nth(1)).toContainText("Copy Files")
  })

  test("step delete via ✕ removes the card after the leave animation", async ({ page }) => {
    await addStep(page)
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(1)

    await stepCards.first().getByRole("button", { name: "✕" }).click()

    // The fade-out runs for 200ms before the splice; the empty-state hint
    // returns once the card is gone. Default toBeVisible timeout (5s)
    // covers the animation comfortably.
    await expect(page.getByText(/No steps yet/)).toBeVisible()
    await expect(stepCards).toHaveCount(0)
  })

  test("(+) Add divider inserts an empty step at the chosen position", async ({ page }) => {
    // Two steps with distinct commands.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^Move Files\s/ }).click()

    // Click the divider between the two steps. Layout is:
    //   [divider 0 — before step 1] [step 1] [divider 1 — between] [step 2] [divider 2 — after]
    // so the between-steps "+ Step" button is at index 1.
    await page.getByRole("button", { name: "➕ Step" }).nth(1).click()

    // Three step cards now, middle one empty.
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(3)
    await expect(stepCards.nth(0)).toContainText("Copy Files")
    await expect(stepCards.nth(1)).toContainText("— pick a command —")
    await expect(stepCards.nth(2)).toContainText("Move Files")
  })

  test("typing a path into a step field auto-promotes it to a path variable on commit", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    // destinationPath has no auto-link (only the main source field does), so
    // its manual input is visible and ready to take typed input.
    const destinationPathInput = page.locator('input[data-field="destinationPath"].manual-input').first()
    await destinationPathInput.fill("/data/output")
    // Blur fires onchange → promotePathToPathVar.
    await destinationPathInput.blur()

    // Two path-var cards now: the original Base Path + the auto-created one
    // holding "/data/output". The new card's input shows that value.
    const pathVarCards = page.locator("[data-path-var]")
    await expect(pathVarCards).toHaveCount(2)
    await expect(pathVarCards.nth(1).locator('input[type="text"]').last()).toHaveValue("/data/output")
  })

  test("the URL captures sequence state and is restored on reload", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    // After picking a command, renderAll runs synchronously and updateUrl
    // writes the ?seq= param. Verify the param is present, then reload.
    await expect(page).toHaveURL(/\?seq=/)
    await page.reload()

    // Same step survives the round-trip via the URL state.
    await expect(page.locator('[id^="step-"]')).toHaveCount(1)
    await expect(page.locator('[id^="step-"]').first()).toContainText("Copy Files")
  })

  test("Run via API posts the YAML to /sequences/run, opens the modal, and reflects the umbrella job's status", async ({ page }) => {
    // Stub the POST so the test doesn't need a real subscriber filesystem.
    await page.route("**/sequences/run", async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() ?? "{}")
      // Confirm the YAML actually shipped: we're testing that the button
      // wires the current builder state into the request body.
      expect(typeof body.yaml).toBe("string")
      expect(body.yaml).toContain("command: copyFiles")
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "test-umbrella-id", logsUrl: "/jobs/test-umbrella-id/logs" }),
      })
    })

    // Stub the SSE stream — emit one log line, then a done event.
    await page.route("**/jobs/test-umbrella-id/logs", async (route) => {
      const sseBody = [
        `data: ${JSON.stringify({ line: "[SEQUENCE] Step copy: starting." })}\n\n`,
        `data: ${JSON.stringify({ line: "[SEQUENCE] Step copy: completed." })}\n\n`,
        `data: ${JSON.stringify({ done: true, status: "completed", results: [], outputs: null })}\n\n`,
      ].join("")
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache", "Connection": "keep-alive" },
        body: sseBody,
      })
    })

    // Build a one-step sequence so the YAML body has content to ship.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    await page.getByRole("button", { name: "▶ Run via API" }).click()

    // Modal opens with the umbrella job id surfaced.
    const modal = page.locator("#api-run-modal")
    await expect(modal).toBeVisible()
    await expect(page.locator("#api-run-jobid")).toContainText("test-umbrella-id")

    // Logs land in the panel as the SSE stream replays.
    await expect(page.locator("#api-run-logs")).toContainText("Step copy: starting.")
    await expect(page.locator("#api-run-logs")).toContainText("Step copy: completed.")

    // Status badge flips to completed once the done event arrives.
    await expect(page.locator("#api-run-status")).toHaveText("completed")
  })

  test("auto-linked step-output renders as { linkedTo, output: folder } in the YAML and survives reload", async ({ page }) => {
    // Two consecutive steps — when the second is given a command, its
    // main source field auto-links to the previous step's folder output.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    await addStep(page)
    await page.getByText("— pick a command —").last().click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^Move Files\s/ }).click()

    await page.getByRole("button", { name: "View YAML" }).click()

    const modal = page.locator("#yaml-modal")
    await expect(modal).toBeVisible()

    // YAML must include the new object form for the auto-linked second step.
    // Single-line form is what jsyaml.dump produces at flowLevel: 3.
    const yamlText = await modal.locator("#yaml-out").innerText()
    expect(yamlText).toMatch(/linkedTo:\s*step\d+/)
    expect(yamlText).toMatch(/output:\s*folder/)

    // Close the modal and reload — the link must round-trip through the URL.
    await page.keyboard.press("Escape")
    await page.reload()
    await page.getByRole("button", { name: "View YAML" }).click()

    const reloadedYaml = await page.locator("#yaml-modal #yaml-out").innerText()
    expect(reloadedYaml).toMatch(/linkedTo:\s*step\d+/)
    expect(reloadedYaml).toMatch(/output:\s*folder/)
  })
})

test.describe("Sequence Builder — groups", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
  })

  test("a divider's + Parallel button inserts a group card with one inner step + parallel badge", async ({ page }) => {
    // Add one step so a divider exists to click. (Empty state has no
    // dividers — the only insert affordance is "Add your first step".)
    await addStep(page)
    await page.getByRole("button", { name: "➕ Parallel" }).first().click()

    // Group container is present and labeled "parallel".
    const group = page.locator(".group-card-parallel")
    await expect(group).toBeVisible()
    await expect(group.getByText("parallel")).toBeVisible()

    // It contains exactly one empty step card whose trigger shows the
    // placeholder (the makeStep null-command form).
    await expect(group.getByText("— pick a command —")).toBeVisible()
    await expect(group.locator(".step-card")).toHaveCount(1)
  })

  test("adding a step to a collapsed group expands it so the new card is visible", async ({ page }) => {
    // Seed with a collapsed serial group containing one step.
    const yaml = [
      "steps:",
      "  - kind: group",
      "    id: hidden",
      "    label: Hidden by default",
      "    isCollapsed: true",
      "    steps:",
      "      - id: only",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /a",
    ].join("\n")
    const seq = Buffer.from(yaml, "utf8").toString("base64")
    await page.goto(`/builder/?seq=${encodeURIComponent(seq)}`)

    const groupCard = page.locator('[data-group="hidden"]')
    await expect(groupCard).toBeVisible()
    // Body hidden initially — only one step inside, but it's not in DOM.
    await expect(groupCard.locator(".step-card")).toHaveCount(0)

    // Click "+ Step" inside the group header — group should auto-expand.
    await groupCard.locator('button[title="Add a step inside this group"]').click()
    await expect(groupCard.locator(".step-card")).toHaveCount(2)
  })

  test("parallel group lays inner steps side-by-side at desktop width and stacks at narrow width", async ({ page }) => {
    // Seed the builder via the URL ?seq= mechanism with a parallel
    // group containing two steps. Faster + more deterministic than
    // building it through clicks.
    const yaml = [
      "steps:",
      "  - kind: group",
      "    id: para",
      "    label: Parallel pair",
      "    isParallel: true",
      "    steps:",
      "      - id: a",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /a",
      "      - id: b",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /b",
    ].join("\n")
    const seq = Buffer.from(yaml, "utf8").toString("base64")
    await page.goto(`/builder/?seq=${encodeURIComponent(seq)}`)

    const group = page.locator(".group-card-parallel")
    await expect(group).toBeVisible()
    const innerSteps = group.locator(".step-card")
    await expect(innerSteps).toHaveCount(2)

    // Desktop width: container is wide enough for the two cards to sit
    // side-by-side, so their bounding boxes overlap horizontally and
    // share approximately the same Y.
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.waitForTimeout(50)
    const desktopFirst = await innerSteps.nth(0).boundingBox()
    const desktopSecond = await innerSteps.nth(1).boundingBox()
    expect(desktopFirst).toBeTruthy()
    expect(desktopSecond).toBeTruthy()
    if (desktopFirst && desktopSecond) {
      // Side-by-side: roughly same Y, second is to the right of first.
      expect(Math.abs(desktopFirst.y - desktopSecond.y)).toBeLessThan(20)
      expect(desktopSecond.x).toBeGreaterThan(desktopFirst.x + desktopFirst.width / 2)
    }

    // Narrow width: container query collapses to single column, so the
    // second card is below the first.
    await page.setViewportSize({ width: 480, height: 900 })
    await page.waitForTimeout(50)
    const narrowFirst = await innerSteps.nth(0).boundingBox()
    const narrowSecond = await innerSteps.nth(1).boundingBox()
    expect(narrowFirst).toBeTruthy()
    expect(narrowSecond).toBeTruthy()
    if (narrowFirst && narrowSecond) {
      expect(narrowSecond.y).toBeGreaterThan(narrowFirst.y + narrowFirst.height / 2)
    }
  })

  test("a group can be moved up/down past adjacent top-level items via its header arrows", async ({ page }) => {
    // Start with: step A → group → step B at the top level. Moving the
    // group down once should yield: step A → step B → group.
    const yaml = [
      "steps:",
      "  - id: a",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /a",
      "  - kind: group",
      "    id: middle",
      "    label: Middle group",
      "    steps:",
      "      - id: m1",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /m",
      "  - id: b",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /b",
    ].join("\n")
    const seq = Buffer.from(yaml, "utf8").toString("base64")
    await page.goto(`/builder/?seq=${encodeURIComponent(seq)}`)

    const groupCard = page.locator('[data-group="middle"]')
    await expect(groupCard).toBeVisible()

    // Click the down arrow in the group header.
    await groupCard.locator('button[title="Move group down"]').click()

    // Inspect the YAML to verify the order changed: a → b → group.
    await page.getByRole("button", { name: "View YAML" }).click()
    const yamlOut = await page.locator("#yaml-modal #yaml-out").innerText()
    const aIdx = yamlOut.indexOf("id: a")
    const bIdx = yamlOut.indexOf("id: b")
    const groupIdx = yamlOut.indexOf("id: middle")
    expect(aIdx).toBeGreaterThan(-1)
    expect(bIdx).toBeGreaterThan(-1)
    expect(groupIdx).toBeGreaterThan(-1)
    expect(aIdx).toBeLessThan(bIdx)
    expect(bIdx).toBeLessThan(groupIdx)
  })

  test("a top-level step jumps past a group when the down arrow hits it", async ({ page }) => {
    // alphaStep → group → omegaStep. Moving alphaStep down once skips
    // the entire group and lands it between the group and omegaStep.
    // (Identifiers picked so substring searches in the YAML can't
    // collide — e.g. the previous "id: b" clashed with "id: barrier".)
    const yaml = [
      "steps:",
      "  - id: alphaStep",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /a",
      "  - kind: group",
      "    id: middleGroup",
      "    steps:",
      "      - id: innerStep",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /g",
      "  - id: omegaStep",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /b",
    ].join("\n")
    const seq = Buffer.from(yaml, "utf8").toString("base64")
    await page.goto(`/builder/?seq=${encodeURIComponent(seq)}`)

    const stepACard = page.locator('[id="step-alphaStep"]')
    await expect(stepACard).toBeVisible()
    await stepACard.locator('button:has-text("↓")').click()

    await page.getByRole("button", { name: "View YAML" }).click()
    const yamlOut = await page.locator("#yaml-modal #yaml-out").innerText()
    const groupIdx = yamlOut.indexOf("id: middleGroup")
    const aIdx = yamlOut.indexOf("id: alphaStep")
    const bIdx = yamlOut.indexOf("id: omegaStep")
    // Expected order: group → alphaStep → omegaStep
    expect(groupIdx).toBeGreaterThan(-1)
    expect(aIdx).toBeGreaterThan(-1)
    expect(bIdx).toBeGreaterThan(-1)
    expect(groupIdx).toBeLessThan(aIdx)
    expect(aIdx).toBeLessThan(bIdx)
  })

  test("the divider's + Group / + Parallel buttons insert a group between items", async ({ page }) => {
    // Add two top-level steps, then click the between-steps "+ Parallel"
    // to slot a parallel group in. The group should render with one
    // empty inner step.
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("makeDirectory")
    await page.getByRole("button", { name: /^Make Directory\s/ }).click()

    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^Copy Files\s/ }).click()

    // Divider layout:
    //   [d 0] [step 1] [d 1] [step 2] [d 2]
    // The between-steps "+ Parallel" is index 1.
    await page.getByRole("button", { name: "➕ Parallel" }).nth(1).click()

    // A parallel group now sits between the two steps.
    const groupCard = page.locator(".group-card-parallel")
    await expect(groupCard).toBeVisible()
    await expect(groupCard.locator(".step-card")).toHaveCount(1)
  })

  test("step collapse chevron round-trips through the URL", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("makeDirectory")
    await page.getByRole("button", { name: /^Make Directory\s/ }).click()

    // Body is open by default — the field label is visible.
    await expect(page.getByText("File Path")).toBeVisible()

    // Click the step's collapse chevron (the first chevron-shaped button
    // in the step header).
    const stepCard = page.locator(".step-card").first()
    await stepCard.locator('button[title*="Collapse step"]').click()

    // Body hidden.
    await expect(page.getByText("File Path")).toBeHidden()

    // Reload — the URL persisted isCollapsed: true.
    await page.reload()
    await expect(page.locator(".step-card").first()).toBeVisible()
    await expect(page.getByText("File Path")).toBeHidden()
  })

  test("recursiveDepth is saved even if the field was not blurred before reload", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("deleteFilesByExtension")
    await page.getByRole("button", { name: /^Delete Files by Extension\s/ }).click()

    // Enable Recursive so the depth field appears.
    await page.getByLabel("Recursive").check()

    const depthInput = page.getByRole("spinbutton", { name: /Depth/ })
    await depthInput.fill("5")
    // Do NOT blur — just reload immediately to simulate closing the tab.
    await page.reload()

    await expect(page.getByRole("spinbutton", { name: /Depth/ })).toHaveValue("5")
  })

  test("DSL rules Predicates panel stays open after adding a predicate entry", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("modifySubtitleMetadata")
    await page.getByRole("button", { name: /^Modify Subtitle Metadata\s/ }).click()

    // Open the Predicates <details> panel.
    const predicatesDetails = page.locator("details[data-details-key$=':predicates']")
    await predicatesDetails.locator("summary").click()
    await expect(predicatesDetails).toHaveAttribute("open")

    // Add a predicate — triggers renderAll which used to close the panel.
    await page.getByRole("button", { name: "+ Add predicate" }).click()

    // Panel must still be open.
    await expect(predicatesDetails).toHaveAttribute("open")
  })

  test("DSL rules When panel stays open after adding a when clause", async ({ page }) => {
    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("modifySubtitleMetadata")
    await page.getByRole("button", { name: /^Modify Subtitle Metadata\s/ }).click()

    // Add a setScriptInfo rule so there is something to expand When on.
    await page.getByRole("button", { name: "+ setScriptInfo" }).first().click()

    // Open the When <details> panel inside the rule card.
    const whenDetails = page.locator("details[data-details-key$=':when:0']")
    await whenDetails.locator("summary").click()
    await expect(whenDetails).toHaveAttribute("open")

    // Add a when clause — triggers renderAll.
    await whenDetails.locator("select").selectOption("anyScriptInfo")

    // Panel must still be open.
    await expect(whenDetails).toHaveAttribute("open")
  })

  test("folderMultiSelect clears selected folders when source path changes", async ({ page }) => {
    await page.route("**/queries/listDirectoryEntries", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [
            { name: "Anime", isDirectory: true, isFile: false },
            { name: "Movies", isDirectory: true, isFile: false },
          ],
          error: null,
        }),
      })
    })

    await addStep(page)
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("storeAspectRatioData")
    await page.getByRole("button", { name: /^Store Aspect Ratio Data\s/ }).click()

    // Set source path so the folder picker knows where to load from.
    const stepCard = page.locator(".step-card").first()
    const sourceInput = stepCard.locator("input[data-field='sourcePath']")
    await sourceInput.focus()
    await sourceInput.fill("G:\\TestSource")
    // Press Escape to commit and close the path-typeahead popover before blur.
    await sourceInput.press("Escape")
    await sourceInput.blur()

    await page.getByRole("button", { name: /Browse folders/ }).click()
    await expect(page.locator("#folder-picker-modal")).toBeVisible()
    await page.getByRole("button", { name: "Anime" }).click()
    await page.getByRole("button", { name: "Confirm" }).click()

    // The selected folder tag must appear in the step card (not inside the hidden modal body).
    const folderTag = stepCard.locator("span.font-mono", { hasText: "Anime" })
    await expect(folderTag).toBeVisible()

    // Now change the source path — previously selected folders must be cleared.
    await sourceInput.focus()
    await sourceInput.fill("G:\\OtherSource")
    await sourceInput.press("Escape")
    await sourceInput.blur()

    await expect(folderTag).toBeHidden()
  })
})
