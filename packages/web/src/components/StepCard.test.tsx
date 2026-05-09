import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stepsAtom } from "../state/stepsAtom"
import type { Step } from "../types"
import { StepCard } from "./StepCard"

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step_1",
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderCard = (step: Step, props: Partial<{ isFirst: boolean; isLast: boolean }> = {}) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <StepCard
        step={step}
        index={0}
        isFirst={props.isFirst ?? true}
        isLast={props.isLast ?? true}
      />
    </Provider>,
  )
  return store
}

beforeEach(() => {
  window.mediaTools = { COMMANDS: {}, renderAll: vi.fn(), updateUrl: vi.fn() }
  window.commandLabel = (name: string) => name
  window.commandPicker = { open: vi.fn(), close: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("StepCard", () => {
  it("renders the step index", () => {
    renderCard(makeStep())
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("shows 'pick a command' when no command set", () => {
    renderCard(makeStep())
    expect(screen.getByText(/pick a command/i)).toBeInTheDocument()
  })

  it("toggles collapsed state on chevron click", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeStep({ isCollapsed: false }))

    await user.click(screen.getByTitle(/collapse step/i))

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).isCollapsed).toBe(true)
  })

  it("shows status badge when step has status", () => {
    renderCard(makeStep({ status: "running" }))
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  it("does not show status badge when status is null", () => {
    renderCard(makeStep({ status: null }))
    expect(screen.queryByText("running")).toBeNull()
  })

  it("removes step from atom when remove button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeStep())

    // open actions panel first
    await user.click(screen.getByTitle(/step actions/i))
    await user.click(screen.getByTitle(/remove/i))

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  it("opens command picker on trigger click", async () => {
    const user = userEvent.setup()
    renderCard(makeStep())

    await user.click(screen.getByRole("button", { name: /pick a command/i }))

    expect(window.commandPicker?.open).toHaveBeenCalled()
  })

  it("shows error message when step has an error", () => {
    renderCard(makeStep({ command: "testCmd", error: "Something went wrong" }))
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("collapses body when isCollapsed is true", () => {
    renderCard(makeStep({ command: "testCmd", isCollapsed: true }))
    expect(screen.queryByText(/Wave B pending/)).toBeNull()
  })
})
