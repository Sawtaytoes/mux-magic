import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { CommandField, Step } from "../../types"
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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  window.setParam = vi.fn()
  window.scheduleReverseLookup = vi.fn()
})

describe("NumberField", () => {
  test("renders a number input", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(
      screen.getByRole("spinbutton"),
    ).toBeInTheDocument()
  })

  test("renders the field label", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(screen.getByText("Width")).toBeInTheDocument()
  })

  test("shows the current param value", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    const input = screen.getByRole(
      "spinbutton",
    ) as HTMLInputElement
    expect(input.value).toBe("1920")
  })

  test("does not render companion text when missing", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(screen.queryByTitle("")).toBeNull()
  })
})
