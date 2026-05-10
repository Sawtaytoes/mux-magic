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
  it,
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
  it("renders a number input", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(
      screen.getByRole("spinbutton"),
    ).toBeInTheDocument()
  })

  it("renders the field label", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(screen.getByText("Width")).toBeInTheDocument()
  })

  it("shows the current param value", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    const input = screen.getByRole(
      "spinbutton",
    ) as HTMLInputElement
    expect(input.value).toBe("1920")
  })

  it("does not render companion text when missing", () => {
    render(
      <NumberField step={mockStep} field={mockField} />,
    )
    expect(screen.queryByTitle("")).toBeNull()
  })
})
