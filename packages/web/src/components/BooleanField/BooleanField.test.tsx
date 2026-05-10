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
  test("renders a checkbox", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  test("renders the field label", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(
      screen.getByText("Enable feature"),
    ).toBeInTheDocument()
  })

  test("reflects a true param as checked", () => {
    render(
      <BooleanField step={mockStep} field={mockField} />,
    )
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  test("reflects a false param as unchecked", () => {
    const step = { ...mockStep, params: { enabled: false } }
    render(<BooleanField step={step} field={mockField} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  test("sets the tooltip data attribute", () => {
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
