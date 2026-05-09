import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import { dryRunAtom, failureModeAtom } from "../state/uiAtoms"
import { PageHeader } from "./PageHeader"

const renderWithStore = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <PageHeader />
    </Provider>,
  )

describe("PageHeader", () => {
  it("renders the title link", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.getByRole("link", { name: "Sequence Builder" })).toBeInTheDocument()
  })

  it("toggles dry-run mode when the Dry Run button is clicked", async () => {
    const store = createStore()
    renderWithStore(store)
    expect(store.get(dryRunAtom)).toBe(false)
    await userEvent.click(screen.getByRole("button", { name: /dry run/i }))
    expect(store.get(dryRunAtom)).toBe(true)
  })

  it("shows the DRY RUN badge only when dry run is active", async () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByTitle(/dry run ON/i)).toBeNull()
    store.set(dryRunAtom, true)
    expect(await screen.findByTitle(/dry run ON/i)).toBeInTheDocument()
  })

  it("shows Simulate Failures toggle only when dry run is active", async () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    renderWithStore(store)
    expect(screen.getByRole("button", { name: /simulate failures/i })).toBeInTheDocument()
  })

  it("hides Simulate Failures toggle when dry run is off", () => {
    const store = createStore()
    renderWithStore(store)
    expect(screen.queryByRole("button", { name: /simulate failures/i })).toBeNull()
  })

  it("toggles failure mode atom", async () => {
    const store = createStore()
    store.set(dryRunAtom, true)
    renderWithStore(store)
    await userEvent.click(screen.getByRole("button", { name: /simulate failures/i }))
    expect(store.get(failureModeAtom)).toBe(true)
  })

  it("disables Run Sequence and Run via API buttons while running", () => {
    const store = createStore()
    const { runningAtom } = require("../state/uiAtoms")
    store.set(runningAtom, true)
    renderWithStore(store)
    expect(screen.getByRole("button", { name: /run sequence/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /run via api/i })).toBeDisabled()
  })
})
