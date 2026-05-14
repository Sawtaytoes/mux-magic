import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider, useAtomValue } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import {
  canUndoAtom,
  undoStackAtom,
} from "../state/historyAtoms"
import { stepsAtom } from "../state/stepsAtom"
import type { Step } from "../types"
import { useBuilderActions } from "./useBuilderActions"
import { useScrollToAffectedStep } from "./useScrollToAffectedStep"

afterEach(cleanup)

const makeStep = (id: string): Step => ({
  id,
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const Harness = () => {
  useScrollToAffectedStep()
  const { undo, redo } = useBuilderActions()
  const steps = useAtomValue(stepsAtom)
  return (
    <>
      {steps.map((item) => (
        <div key={item.id} id={`step-${item.id}`} />
      ))}
      <button type="button" onClick={undo}>
        Undo
      </button>
      <button type="button" onClick={redo}>
        Redo
      </button>
    </>
  )
}

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <Harness />
    </Provider>,
  )

describe("useScrollToAffectedStep", () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollIntoViewSpy = vi.fn()
    Element.prototype.scrollIntoView =
      scrollIntoViewSpy as unknown as typeof Element.prototype.scrollIntoView
  })

  test("scrolls to a step restored by undo", async () => {
    const allSteps = Array.from(
      { length: 10 },
      (_, index) => makeStep(`step${index + 1}`),
    )
    const stepsWithoutStep7 = allSteps.filter(
      (step) => step.id !== "step7",
    )

    const store = createStore()
    store.set(undoStackAtom, [
      { steps: allSteps, paths: [], stepCounter: 10 },
    ])
    store.set(canUndoAtom, true)
    store.set(stepsAtom, stepsWithoutStep7)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    const step7El = document.getElementById("step-step7")
    expect(step7El).not.toBeNull()
    expect(scrollIntoViewSpy.mock.contexts[0]).toBe(step7El)
  })

  test("scrolls with behavior:auto when prefers-reduced-motion is set", async () => {
    const allSteps = [makeStep("stepA"), makeStep("stepB")]
    const stepsWithoutB = [makeStep("stepA")]

    const store = createStore()
    store.set(undoStackAtom, [
      { steps: allSteps, paths: [], stepCounter: 2 },
    ])
    store.set(canUndoAtom, true)
    store.set(stepsAtom, stepsWithoutB)

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    })

    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: "auto",
        block: "center",
      })
    })
  })

  test("does not scroll when undo restores an empty state", async () => {
    const store = createStore()
    const steps = [makeStep("step1"), makeStep("step2")]
    store.set(undoStackAtom, [
      { steps: [], paths: [], stepCounter: 2 },
    ])
    store.set(canUndoAtom, true)
    store.set(stepsAtom, steps)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
  })

  test("scrolls to a step restored by redo", async () => {
    const allSteps = [
      makeStep("stepX"),
      makeStep("stepY"),
      makeStep("stepZ"),
    ]
    const stepsWithoutZ = allSteps.filter(
      (step) => step.id !== "stepZ",
    )

    const store = createStore()
    const { redoStackAtom, canRedoAtom } = await import(
      "../state/historyAtoms"
    )
    store.set(redoStackAtom, [
      { steps: allSteps, paths: [], stepCounter: 3 },
    ])
    store.set(canRedoAtom, true)
    store.set(stepsAtom, stepsWithoutZ)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    const stepZEl = document.getElementById("step-stepZ")
    expect(stepZEl).not.toBeNull()
    expect(scrollIntoViewSpy.mock.contexts[0]).toBe(stepZEl)
  })
})
