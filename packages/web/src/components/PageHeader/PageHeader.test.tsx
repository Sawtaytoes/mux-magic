import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"

afterEach(() => {
  cleanup()
})

import {
  dryRunAtom,
  failureModeAtom,
} from "../../state/dryRunQuery"
import { runningAtom } from "../../state/runAtoms"
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
