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
import type { CommandField, Step } from "../types"
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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  window.setParamAndRender = vi.fn()
})

describe("BooleanField", () => {
  it("renders a checkbox", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("renders the field label", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(
      screen.getByText("Enable feature"),
    ).toBeInTheDocument()
  })

  it("reflects a true param as checked", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("reflects a false param as unchecked", () => {
    const step = { ...mockStep, params: { enabled: false } }
    render(<BooleanField step={step} field={mockField} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("sets the tooltip data attribute", () => {
    const { container } = render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(
      container.querySelector(
        "[data-tooltip-key='ffmpeg:enabled']",
      ),
    ).not.toBeNull()
  })
})
