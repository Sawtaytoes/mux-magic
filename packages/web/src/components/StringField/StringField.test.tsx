import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { stepsAtom } from "../../state/stepsAtom"
import type { CommandField, Step } from "../../types"
import { StringField } from "./StringField"

const mockStep: Step = {
  id: "step1",
  alias: "",
  command: "ffmpeg",
  params: { filename: "output.mp4" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const mockField: CommandField = {
  name: "filename",
  type: "string",
  label: "Filename",
  placeholder: "e.g. output.mp4",
}

const renderField = (
  step: Step = mockStep,
  field: CommandField = mockField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <StringField field={field} step={step} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("StringField", () => {
  test("renders a text input", () => {
    renderField()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("renders the field label", () => {
    renderField()
    expect(screen.getByText("Filename")).toBeInTheDocument()
  })

  test("shows the current param value", () => {
    renderField()
    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.value).toBe("output.mp4")
  })

  test("shows the placeholder when provided", () => {
    const step = { ...mockStep, params: {} }
    renderField(step)
    expect(
      screen.getByPlaceholderText("e.g. output.mp4"),
    ).toBeInTheDocument()
  })

  test("empty string defaults to empty", () => {
    const step = { ...mockStep, params: { filename: "" } }
    renderField(step)
    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.value).toBe("")
  })
})
