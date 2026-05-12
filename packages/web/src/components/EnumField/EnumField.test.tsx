import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { CommandField } from "../../commands/types"
import type { Step } from "../../types"
import { EnumField } from "./EnumField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "nameAnimeEpisodesAniDB",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderWithJotai = (
  step: Step,
  field: CommandField,
) => {
  const store = createStore()
  render(
    <Provider store={store}>
      <EnumField step={step} field={field} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("EnumField", () => {
  test("renders selected value from step params", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2]
    const step = createMockStep({
      params: { episodeType: "specials" },
    })

    renderWithJotai(step, field)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Specials (S, type=2)")
  })

  test("renders default value when params undefined", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2]
    const step = createMockStep()

    renderWithJotai(step, field)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Regular (type=1)")
  })

  test("renders chevron indicator", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2]
    const step = createMockStep()

    renderWithJotai(step, field)

    expect(screen.getByText("▾")).toBeInTheDocument()
  })

  test("uses field label component", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2]
    const step = createMockStep()

    renderWithJotai(step, field)

    expect(
      screen.getByText("Episode Type"),
    ).toBeInTheDocument()
  })
})
