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

describe("StepCard interactive", () => {
  test("renders a step with keepLanguages command and wired atoms", () => {
    renderWithAtoms(makeStep())
    expect(
      screen.getByText("Filter Languages"),
    ).toBeInTheDocument()
  })

  test("renders fields for the step when command is known", () => {
    renderWithAtoms(makeStep())
    // keepLanguages has audioLanguages field
    expect(
      screen.getByDisplayValue("eng, jpn"),
    ).toBeInTheDocument()
  })

  test("shows command label from commands atom", () => {
    renderWithAtoms(
      makeStep({ command: "nameAnimeEpisodes" }),
    )
    // Command exists in FIXTURE_COMMANDS
    const commandSection = screen.getByText(
      "Rename anime episode files using MyAnimeList metadata",
    )
    expect(commandSection).toBeInTheDocument()
  })
})
