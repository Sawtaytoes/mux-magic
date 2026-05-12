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
import { LanguageCodesField } from "./LanguageCodesField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "keepLanguages",
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
      <LanguageCodesField step={step} field={field} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("LanguageCodesField", () => {
  test("renders array value as comma-separated string", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]
    const step = createMockStep({
      params: { audioLanguages: ["eng", "jpn"] },
    })

    renderWithJotai(step, field)

    const input = screen.getByDisplayValue(
      "eng, jpn",
    ) as HTMLInputElement
    expect(input.value).toBe("eng, jpn")
  })

  test("renders empty when params undefined", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    const input = screen.getByDisplayValue(
      "",
    ) as HTMLInputElement
    expect(input.value).toBe("")
  })

  test("uses field placeholder from definition", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    const input = screen.getByPlaceholderText(
      "eng, jpn",
    ) as HTMLInputElement
    expect(input.placeholder).toBe("eng, jpn")
  })

  test("uses field label component", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]
    const step = createMockStep()

    renderWithJotai(step, field)

    expect(
      screen.getByText("Audio Languages"),
    ).toBeInTheDocument()
  })

  test("renders single code without trailing comma", () => {
    const field =
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]
    const step = createMockStep({
      params: { audioLanguages: ["eng"] },
    })

    renderWithJotai(step, field)

    const input = screen.getByDisplayValue(
      "eng",
    ) as HTMLInputElement
    expect(input.value).toBe("eng")
  })
})
