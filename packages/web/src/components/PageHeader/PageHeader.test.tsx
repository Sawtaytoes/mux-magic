import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

afterEach(() => {
  cleanup()
  history.replaceState(null, "", window.location.pathname)
})

import type { Commands } from "../../commands/types"
import { commandsAtom } from "../../state/commandsAtom"
import {
  dryRunAtom,
  failureModeAtom,
} from "../../state/dryRunQuery"
import { runningAtom } from "../../state/runAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import { editVariablesModalOpenAtom } from "../EditVariablesModal/editVariablesModalOpenAtom"
import { LoadModal } from "../LoadModal/LoadModal"
import {
  loadModalAutoPastingAtom,
  loadModalOpenAtom,
} from "../LoadModal/loadModalAtom"
import { PageHeader } from "./PageHeader"

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <PageHeader />
    </Provider>,
  )

// Controls (Dry Run, Run Sequence, etc.) live inside the controls popover,
// which is `aria-hidden` until its toggle is clicked. Open it before any
// role-based query against its contents.
const openControlsMenu = async () => {
  await userEvent.click(
    screen.getByRole("button", {
      name: /sequence actions/i,
    }),
  )
}

describe("PageHeader", () => {
  test("renders the title link", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      screen.getByRole("link", {
        name: "Sequence Builder",
      }),
    ).toBeInTheDocument()
  })

  test("toggles dry-run mode when the Dry Run button is clicked", async () => {
    const store = createStore()
    renderWithStore(store)
    expect(store.get(dryRunAtom)).toBe(false)
    await openControlsMenu()
    await userEvent.click(
      screen.getByRole("button", { name: /dry run/i }),
    )
    expect(store.get(dryRunAtom)).toBe(true)
  })

  test("clicking Dry Run updates URL to ?fake=success", async () => {
    const store = createStore()
    renderWithStore(store)
    await openControlsMenu()
    await userEvent.click(
      screen.getByRole("button", { name: /dry run/i }),
    )
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("success")
  })

  test("clicking Dry Run does not write to localStorage", async () => {
    const store = createStore()
    renderWithStore(store)
    const setItemSpy = vi.spyOn(
      window.localStorage.__proto__,
      "setItem",
    )
    await openControlsMenu()
    await userEvent.click(
      screen.getByRole("button", { name: /dry run/i }),
    )
    const dryRunCalls = setItemSpy.mock.calls.filter(
      ([key]) =>
        key === "isDryRun" || key === "dryRunScenario",
    )
    expect(dryRunCalls).toHaveLength(0)
    setItemSpy.mockRestore()
  })

  test("shows the DRY RUN badge only when dry run is active", async () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByTitle(/dry run ON/i)).toBeNull()
    store.set(dryRunAtom, true)
    expect(
      await screen.findByTitle(/dry run ON/i),
    ).toBeInTheDocument()
  })

  test("shows Simulate Failures toggle only when dry run is active", async () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    renderWithStore(store)
    await openControlsMenu()
    expect(
      screen.getByRole("button", {
        name: /simulate failures/i,
      }),
    ).toBeInTheDocument()
  })

  test("hides Simulate Failures toggle when dry run is off", () => {
    const store = createStore()
    renderWithStore(store)
    expect(
      screen.queryByRole("button", {
        name: /simulate failures/i,
      }),
    ).toBeNull()
  })

  test("toggles failure mode atom", async () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    renderWithStore(store)
    await openControlsMenu()
    await userEvent.click(
      screen.getByRole("button", {
        name: /simulate failures/i,
      }),
    )
    expect(store.get(failureModeAtom)).toBe(true)
  })

  test("clicking Simulate Failures updates URL to ?fake=failure", async () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    renderWithStore(store)
    await openControlsMenu()
    await userEvent.click(
      screen.getByRole("button", {
        name: /simulate failures/i,
      }),
    )
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("failure")
  })

  test("DRY RUN badge has amber classes when failureMode is false", () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, false)
    renderWithStore(store)
    const badge = document.getElementById("dry-run-badge")
    expect(badge).not.toBeNull()
    expect(badge?.className).toContain("text-amber-400")
    expect(badge?.className).not.toContain("text-red-400")
  })

  test("DRY RUN badge has red classes when failureMode is true", () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, true)
    renderWithStore(store)
    const badge = document.getElementById("dry-run-badge")
    expect(badge).not.toBeNull()
    expect(badge?.className).toContain("text-red-400")
    expect(badge?.className).not.toContain("text-amber-400")
  })

  test("DRY RUN badge title mentions failure mode when failureMode is true", () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    store.set(failureModeAtom, true)
    renderWithStore(store)
    const badge = document.getElementById("dry-run-badge")
    expect(badge?.getAttribute("title")).toContain(
      "failure mode",
    )
  })

  test("Variables button is visible in the header", () => {
    const store = createStore()
    renderWithStore(store)
    const toolbar = screen.getByRole("toolbar", {
      name: /header actions/i,
    })
    expect(
      within(toolbar).getByRole("button", {
        name: /variables/i,
      }),
    ).toBeInTheDocument()
  })

  test("clicking Variables button sets editVariablesModalOpenAtom to true", async () => {
    const user = userEvent.setup()
    const store = createStore()
    renderWithStore(store)
    expect(store.get(editVariablesModalOpenAtom)).toBe(
      false,
    )
    const toolbar = screen.getByRole("toolbar", {
      name: /header actions/i,
    })
    await user.click(
      within(toolbar).getByRole("button", {
        name: /variables/i,
      }),
    )
    expect(store.get(editVariablesModalOpenAtom)).toBe(true)
  })

  test("nav + controls menus stay mounted while closed and expose aria-hidden", () => {
    const store = createStore()
    renderWithStore(store)
    const navMenu = document.getElementById(
      "page-actions-nav",
    )
    const controlsMenu = document.getElementById(
      "page-actions-controls",
    )
    expect(navMenu).not.toBeNull()
    expect(controlsMenu).not.toBeNull()
    expect(navMenu?.getAttribute("aria-hidden")).toBe(
      "true",
    )
    expect(controlsMenu?.getAttribute("aria-hidden")).toBe(
      "true",
    )
    expect(navMenu?.className).not.toContain("open")
    expect(controlsMenu?.className).not.toContain("open")
  })

  test("opening the nav menu flips its aria-hidden and adds .open", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: /open menu/i }),
    )
    const navMenu = document.getElementById(
      "page-actions-nav",
    )
    expect(navMenu?.getAttribute("aria-hidden")).toBe(
      "false",
    )
    expect(navMenu?.className).toContain("open")
  })

  test("opening the controls menu flips its aria-hidden and adds .open", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", {
        name: /sequence actions/i,
      }),
    )
    const controlsMenu = document.getElementById(
      "page-actions-controls",
    )
    expect(controlsMenu?.getAttribute("aria-hidden")).toBe(
      "false",
    )
    expect(controlsMenu?.className).toContain("open")
  })

  test("disables Run Sequence and Run via API buttons while running", async () => {
    const store = createStore()
    store.set(runningAtom, true)
    renderWithStore(store)
    await openControlsMenu()
    expect(
      screen.getByRole("button", { name: /run sequence/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: /run via api/i }),
    ).toBeDisabled()
  })
})

// ─── Load button auto-paste / no-flash invariant ──────────────────────────────

// Worker 3d regression guard. Worker 0b made the Load button onClick async
// (await navigator.clipboard.readText() BEFORE deciding whether to open the
// modal). That broke the e2e variable-YAML round-trip test because the modal
// opened AFTER the test's synthetic paste event had already fired and been
// dropped — leaving the backdrop in the DOM to intercept the next click.
//
// The fix opens the modal synchronously while also flipping
// loadModalAutoPastingAtom synchronously, so LoadModal's paste listener
// attaches immediately (catching synthetic pastes) while the Modal primitive
// renders nothing (no visible flash). The tests below lock in both halves of
// that invariant.

const mockCommandsForLoad: Commands = {
  testCommand: {
    fields: [{ name: "inputPath", type: "path" }],
  },
}

const minimalYaml = `
- command: testCommand
  params:
    inputPath: /some/path
`.trim()

const renderHeaderAndLoadModal = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <PageHeader />
      <LoadModal />
    </Provider>,
  )

const clickLoadButton = async () => {
  await openControlsMenu()
  const loadButton = document.getElementById(
    "load-btn",
  ) as HTMLButtonElement | null
  expect(loadButton).not.toBeNull()
  await userEvent.click(loadButton as HTMLButtonElement)
}

describe("PageHeader Load button — no-flash invariant", () => {
  test("does not render the modal backdrop while clipboard.readText() is in flight", async () => {
    // Never resolves — simulates a slow / hanging clipboard read.
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockReturnValue(new Promise<string>(() => {}))

    const store = createStore()
    store.set(commandsAtom, mockCommandsForLoad)
    renderHeaderAndLoadModal(store)

    await clickLoadButton()

    // The modal is logically "open" so its paste listener is attached,
    // but the Modal primitive is gated on `isOpen && !isAutoPasting` so
    // its backdrop must NOT be in the DOM.
    expect(store.get(loadModalOpenAtom)).toBe(true)
    expect(store.get(loadModalAutoPastingAtom)).toBe(true)
    expect(
      document.querySelector(".bg-black\\/70"),
    ).toBeNull()
    expect(screen.queryByText("Load YAML")).toBeNull()
  })

  test("synthetic paste with valid YAML during auto-paste-in-flight loads the YAML and never reveals the modal", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockReturnValue(new Promise<string>(() => {}))

    const store = createStore()
    store.set(commandsAtom, mockCommandsForLoad)
    renderHeaderAndLoadModal(store)

    await clickLoadButton()
    // Paste listener is now armed (LoadModal effect ran on isOpen=true)
    // even though the Modal is not rendered.
    expect(
      document.querySelector(".bg-black\\/70"),
    ).toBeNull()

    // Dispatch the same kind of event the e2e test does.
    const pasteEvent = new Event("paste", {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        getData: (_type: string) => minimalYaml,
      },
    })
    document.dispatchEvent(pasteEvent)

    // YAML applied + modal closed atomically. Backdrop never appears.
    expect(store.get(stepsAtom)).toHaveLength(1)
    expect(store.get(stepsAtom)[0]).toMatchObject({
      command: "testCommand",
    })
    expect(store.get(loadModalOpenAtom)).toBe(false)
    expect(
      document.querySelector(".bg-black\\/70"),
    ).toBeNull()
  })

  test("reveals the modal after clipboard.readText() rejects (manual paste fallback)", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    )

    const store = createStore()
    store.set(commandsAtom, mockCommandsForLoad)
    renderHeaderAndLoadModal(store)

    await clickLoadButton()

    // After the rejected promise + finally block flush, the modal becomes
    // visible so the user can press Ctrl+V manually.
    expect(
      await screen.findByText("Load YAML"),
    ).toBeInTheDocument()
    expect(store.get(loadModalOpenAtom)).toBe(true)
    expect(store.get(loadModalAutoPastingAtom)).toBe(false)
  })
})
