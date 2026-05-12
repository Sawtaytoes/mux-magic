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
import { BooleanField } from "./BooleanField"

const mockStep: Step = {
  id: "step1",
  alias: "",
  command: "ffmpeg",
  params: { enabled: true },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const mockField: CommandField = {
  name: "enabled",
  type: "boolean",
  label: "Enable feature",
}

const renderField = (
  step: Step = mockStep,
  field: CommandField = mockField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <BooleanField field={field} step={step} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("BooleanField", () => {
  test("renders a checkbox", () => {
    renderField()
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  test("renders the field label", () => {
    renderField()
    expect(
      screen.getByText("Enable feature"),
    ).toBeInTheDocument()
  })

  test("reflects a true param as checked", () => {
    renderField()
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  test("reflects a false param as unchecked", () => {
    const step = { ...mockStep, params: { enabled: false } }
    renderField(step)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  test("uses default when param missing", () => {
    const field = { ...mockField, default: true }
    renderField({ ...mockStep, params: {} }, field)
    expect(screen.getByRole("checkbox")).toBeChecked()
  })
})
