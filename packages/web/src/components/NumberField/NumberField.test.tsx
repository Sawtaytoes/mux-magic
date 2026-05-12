import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { NumberField } from "./NumberField"

const mockStep: Step = {
  id: "step1",
  alias: "",
  command: "resize",
  params: { width: 1920 },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const mockField: CommandField = {
  name: "width",
  type: "number",
  label: "Width",
  placeholder: "e.g. 1920",
}

const renderField = (
  step: Step = mockStep,
  field: CommandField = mockField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <NumberField field={field} step={step} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("NumberField", () => {
  test("renders a number input", () => {
    renderField()
    expect(
      screen.getByRole("spinbutton"),
    ).toBeInTheDocument()
  })

  test("renders the field label", () => {
    renderField()
    expect(screen.getByText("Width")).toBeInTheDocument()
  })

  test("shows the current param value", () => {
    renderField()
    const input = screen.getByRole(
      "spinbutton",
    ) as HTMLInputElement
    expect(input.value).toBe("1920")
  })

  test("does not render companion text when missing", () => {
    renderField()
    expect(screen.queryByTitle("")).toBeNull()
  })

  test("uses default when param missing", () => {
    const field = { ...mockField, default: 1080 }
    renderField({ ...mockStep, params: {} }, field)
    const input = screen.getByRole(
      "spinbutton",
    ) as HTMLInputElement
    expect(input.value).toBe("1080")
  })
})
