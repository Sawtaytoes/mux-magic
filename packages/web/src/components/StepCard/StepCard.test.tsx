import {
  cleanup,
  render,
  screen,
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
import { commandsAtom } from "../../state/commandsAtom"
import { commandPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
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

const renderCard = (
  step: Step,
  props: Partial<{
    isFirst: boolean
    isLast: boolean
  }> = {},
) => {
  const store = createStore()
  store.set(commandsAtom, {
    testCmd: {
      summary: "Test command",
      fields: [],
      outputFolderName: null,
    },
  })
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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("StepCard", () => {
  test("renders the step index", () => {
    renderCard(makeStep())
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  test("shows 'pick a command' when no command set", () => {
    renderCard(makeStep())
    expect(
      screen.getByText(/pick a command/i),
    ).toBeInTheDocument()
  })

  test("toggles collapsed state on chevron click", async () => {
    const user = userEvent.setup()
    const store = renderCard(
      makeStep({ isCollapsed: false }),
    )

    await user.click(screen.getByTitle(/collapse step/i))

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).isCollapsed).toBe(true)
  })

  test("shows status badge when step has status", () => {
    renderCard(makeStep({ status: "running" }))
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  test("does not show status badge when status is null", () => {
    renderCard(makeStep({ status: null }))
    expect(screen.queryByText("running")).toBeNull()
  })

  test("removes step from atom when remove button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeStep())

    // open actions panel first
    await user.click(screen.getByTitle(/step actions/i))
    await user.click(screen.getByTitle(/remove this step/i))

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("opens command picker on trigger click", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeStep())

    await user.click(
      screen.getByRole("button", {
        name: /pick a command/i,
      }),
    )

    expect(store.get(commandPickerStateAtom)).not.toBeNull()
    expect(
      store.get(commandPickerStateAtom)?.anchor.stepId,
    ).toBe("step_1")
  })

  test("shows error message when step has an error", () => {
    renderCard(
      makeStep({
        command: "testCmd",
        error: "Something went wrong",
      }),
    )
    expect(
      screen.getByText("Something went wrong"),
    ).toBeInTheDocument()
  })

  test("collapses body when isCollapsed is true", () => {
    renderCard(
      makeStep({ command: "testCmd", isCollapsed: true }),
    )
    expect(screen.queryByText(/Wave B pending/)).toBeNull()
  })

  test("B12: calls startViewTransition when ✕ delete button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeStep())

    await user.click(screen.getByTitle(/step actions/i))
    await user.click(screen.getByTitle(/remove this step/i))

    expect(spy).toHaveBeenCalledOnce()
  })

  test("B1: calls startViewTransition when ↑ button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeStep(), { isFirst: false, isLast: true })

    await user.click(screen.getByTitle(/step actions/i))
    await user.click(screen.getByLabelText(/move step up/i))

    expect(spy).toHaveBeenCalledOnce()
  })

  test("B1: calls startViewTransition when ↓ button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeStep(), { isFirst: true, isLast: false })

    await user.click(screen.getByTitle(/step actions/i))
    await user.click(
      screen.getByLabelText(/move step down/i),
    )

    expect(spy).toHaveBeenCalledOnce()
  })
})
