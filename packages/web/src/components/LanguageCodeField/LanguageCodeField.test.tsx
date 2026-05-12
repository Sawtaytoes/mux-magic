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
import { LanguageCodeField } from "./LanguageCodeField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "changeTrackLanguages",
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
      <LanguageCodeField step={step} field={field} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("LanguageCodeField", () => {
  test("renders text input with current value", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1]
    const step = createMockStep({
      params: { audioLanguage: "jpn" },
    })

    renderWithJotai(step, field)

    const input = screen.getByDisplayValue(
      "jpn",
    ) as HTMLInputElement
    expect(input.value).toBe("jpn")
  })

  test("renders empty when params undefined", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    const input = screen.getByDisplayValue(
      "",
    ) as HTMLInputElement
    expect(input.value).toBe("")
  })

  test("has maxlength of 3 characters", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.maxLength).toBe(3)
  })

  test("has correct placeholder text", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    const input = screen.getByPlaceholderText(
      "eng",
    ) as HTMLInputElement
    expect(input.placeholder).toBe("eng")
  })

  test("uses field label component", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    expect(
      screen.getByText("Audio Language"),
    ).toBeInTheDocument()
  })
})
