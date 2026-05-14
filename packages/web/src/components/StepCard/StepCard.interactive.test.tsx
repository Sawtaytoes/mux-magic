import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS } from "../../commands/__fixtures__/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"

afterEach(() => {
  cleanup()
})

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step_1",
  alias: "Filter Languages",
  command: "keepLanguages",
  params: {
    sourcePath: "/mnt/input",
    audioLanguages: ["eng", "jpn"],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderWithAtoms = (
  step: Step,
  props: Partial<{
    isFirst: boolean
    isLast: boolean
  }> = {},
) => {
  const store = createStore()
  store.set(commandsAtom, FIXTURE_COMMANDS)
  store.set(stepsAtom, [step])
  const { container } = render(
    <Provider store={store}>
      <StepCard
        step={step}
        index={0}
        isFirst={props.isFirst ?? true}
        isLast={props.isLast ?? true}
      />
    </Provider>,
  )
  return { store, container }
}

describe("StepCard interactive", () => {
  test("renders a step with keepLanguages command and wired atoms", () => {
    const { container } = renderWithAtoms(makeStep())
    // alias is rendered as an <input> defaultValue, so use data-step-card to confirm mount
    const stepCard = container.querySelector(
      "[data-step-card='step_1']",
    )
    expect(stepCard).toBeInTheDocument()
  })

  test("renders fields for the step when command is known", () => {
    renderWithAtoms(makeStep())
    // keepLanguages has audioLanguages field — now rendered as language tags
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Japanese")).toBeInTheDocument()
  })

  test("renders modifySubtitleMetadata step with subtitle rules field", () => {
    const { container } = renderWithAtoms(
      makeStep({
        command: "modifySubtitleMetadata",
        params: { sourcePath: "/mnt/subs", rules: [] },
      }),
    )
    const stepCard = container.querySelector(
      "[data-step-card='step_1']",
    )
    expect(stepCard).toBeInTheDocument()
  })
})
