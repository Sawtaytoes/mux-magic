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

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  window.setParam = vi.fn()
})

describe("StringField", () => {
  test("renders a text input", () => {
    render(
      <StringField step={mockStep} field={mockField} />,
    )
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("renders the field label", () => {
    render(
      <StringField step={mockStep} field={mockField} />,
    )
    expect(screen.getByText("Filename")).toBeInTheDocument()
  })

  test("shows the current param value", () => {
    render(
      <StringField step={mockStep} field={mockField} />,
    )
    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.value).toBe("output.mp4")
  })

  test("shows the placeholder when provided", () => {
    const step = { ...mockStep, params: {} }
    render(<StringField step={step} field={mockField} />)
    expect(
      screen.getByPlaceholderText("e.g. output.mp4"),
    ).toBeInTheDocument()
  })
})
