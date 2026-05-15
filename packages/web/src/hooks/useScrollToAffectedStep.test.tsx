import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  createStore,
  Provider,
  useAtomValue,
  useSetAtom,
} from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { isGroup } from "../jobs/sequenceUtils"
import {
  canUndoAtom,
  scrollToStepAtom,
  undoStackAtom,
} from "../state/historyAtoms"
import { addStepToGroupAtom } from "../state/stepAtoms"
import { stepCounterAtom, stepsAtom } from "../state/stepsAtom"
import type { Group, Step } from "../types"
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

const renderItem = (item: Step | Group) => {
  if (isGroup(item)) {
    return (
      <div key={item.id} data-group={item.id}>
        {item.steps.map((step) => (
          <div key={step.id} id={`step-${step.id}`} />
        ))}
      </div>
    )
  }
  return <div key={item.id} id={`step-${item.id}`} />
}

const Harness = () => {
  useScrollToAffectedStep()
  const { undo, redo, insertStep, insertGroup, pasteCardAt } =
    useBuilderActions()
  const addStepToGroup = useSetAtom(addStepToGroupAtom)
  const scrollToStep = useSetAtom(scrollToStepAtom)
  const items = useAtomValue(stepsAtom)
  return (
    <>
      {items.map(renderItem)}
      <button type="button" onClick={undo}>
        Undo
      </button>
      <button type="button" onClick={redo}>
        Redo
      </button>
      <button
        type="button"
        onClick={() => insertStep(items.length)}
      >
        Insert Step At End
      </button>
      <button
        type="button"
        onClick={() => insertGroup(items.length, false)}
      >
        Insert Group At End
      </button>
      <button
        type="button"
        onClick={() => {
          const firstGroup = items.find(isGroup) as
            | Group
            | undefined
          if (!firstGroup) return
          const newId = addStepToGroup(firstGroup.id)
          if (newId) scrollToStep(newId)
        }}
      >
        Add Step To First Group
      </button>
      <button
        type="button"
        onClick={() => {
          void pasteCardAt({})
        }}
      >
        Paste At End
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
      {
        steps: allSteps,
        paths: [],
        stepCounter: 10,
        threadCount: null,
      },
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
      {
        steps: allSteps,
        paths: [],
        stepCounter: 2,
        threadCount: null,
      },
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
      {
        steps: [],
        paths: [],
        stepCounter: 2,
        threadCount: null,
      },
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

  test("scrolls to the new step when insertStep is called at the end", async () => {
    const initial = Array.from({ length: 5 }, (_, i) =>
      makeStep(`step${i + 1}`),
    )
    const store = createStore()
    store.set(stepsAtom, initial)
    store.set(stepCounterAtom, 5)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", {
        name: "Insert Step At End",
      }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    const newStepEl = document.getElementById("step-step6")
    expect(newStepEl).not.toBeNull()
    expect(scrollIntoViewSpy.mock.contexts[0]).toBe(newStepEl)
  })

  test("scrolls to the new step inside a group when insertGroup is called", async () => {
    const store = createStore()
    store.set(stepsAtom, [makeStep("existing")])
    store.set(stepCounterAtom, 1)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", {
        name: "Insert Group At End",
      }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    // The scroll target should be the new step inside the group, not
    // the group container itself.
    const newStepEl = document.getElementById("step-step2")
    expect(newStepEl).not.toBeNull()
    expect(scrollIntoViewSpy.mock.contexts[0]).toBe(newStepEl)
  })

  test("scrolls to the new step when addStepToGroup appends inside a group", async () => {
    const existingStep = makeStep("inGroupA")
    const group: Group = {
      kind: "group",
      id: "groupA",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [existingStep],
    }
    const store = createStore()
    store.set(stepsAtom, [group])
    store.set(stepCounterAtom, 7)

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", {
        name: "Add Step To First Group",
      }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    // addStepToGroupAtom uses the underscore form `step_${n+1}`
    const newStepEl = document.getElementById("step-step_8")
    expect(newStepEl).not.toBeNull()
    expect(scrollIntoViewSpy.mock.contexts[0]).toBe(newStepEl)
  })

  test("scrolls to the first pasted step after pasteCardAt", async () => {
    const pastedYaml = [
      "paths: {}",
      "steps:",
      "  - id: pasted_one",
      "    command: ''",
      "  - id: pasted_two",
      "    command: ''",
    ].join("\n")
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue(pastedYaml)
    // pasteCardAt wraps the state update in startViewTransition.
    // Mock so the callback runs immediately (mirrors GroupCard.test).
    vi.spyOn(
      document,
      "startViewTransition",
    ).mockImplementation((fn) => {
      ;(fn as () => void)?.()
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => {},
      } as unknown as ViewTransition
    })

    const store = createStore()
    store.set(stepsAtom, [makeStep("existing")])

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Paste At End" }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    // The first pasted step (pasted_one) should be the scroll target.
    // loadYamlFromText preserves source ids when they don't collide
    // with existingIds, and "existing" is the only seeded id.
    const target = scrollIntoViewSpy.mock.contexts[0]
    expect(target).toBeInstanceOf(HTMLElement)
    expect((target as HTMLElement).id).toBe("step-pasted_one")
  })

  test("scrolls into the first child step when pasting a group at the top level", async () => {
    const pastedYaml = [
      "paths: {}",
      "steps:",
      "  - kind: group",
      "    id: pasted_group",
      "    isParallel: false",
      "    steps:",
      "      - id: child_one",
      "        command: ''",
      "      - id: child_two",
      "        command: ''",
    ].join("\n")
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue(pastedYaml)
    vi.spyOn(
      document,
      "startViewTransition",
    ).mockImplementation((fn) => {
      ;(fn as () => void)?.()
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => {},
      } as unknown as ViewTransition
    })

    const store = createStore()
    store.set(stepsAtom, [makeStep("existing")])

    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Paste At End" }),
    )

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled()
    })

    // For a top-level group paste the scroll target should descend into
    // the group's first child (the group container has no `#step-<id>`).
    const target = scrollIntoViewSpy.mock.contexts[0]
    expect(target).toBeInstanceOf(HTMLElement)
    expect((target as HTMLElement).id).toBe("step-child_one")
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
      {
        steps: allSteps,
        paths: [],
        stepCounter: 3,
        threadCount: null,
      },
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
