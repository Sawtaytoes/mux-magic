import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { FieldTooltip } from "./FieldTooltip"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("FieldTooltip", () => {
  test("renders children", () => {
    render(
      <FieldTooltip description="A helpful tip">
        Label text
      </FieldTooltip>,
    )
    expect(
      screen.getByText("Label text"),
    ).toBeInTheDocument()
  })

  test("tooltip is hidden initially", () => {
    render(
      <FieldTooltip description="A helpful tip">
        Label
      </FieldTooltip>,
    )
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  test("shows tooltip on click when there is a description", async () => {
    const user = userEvent.setup()
    render(
      <FieldTooltip description="A helpful tip">
        Label
      </FieldTooltip>,
    )

    await user.click(screen.getByText("Label"))

    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    expect(screen.getByRole("tooltip").textContent).toBe(
      "A helpful tip",
    )
  })

  test("hides tooltip on second click", async () => {
    const user = userEvent.setup()
    render(
      <FieldTooltip description="A helpful tip">
        Label
      </FieldTooltip>,
    )

    await user.click(screen.getByText("Label"))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    await user.click(screen.getByText("Label"))
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  test("does not show tooltip when description is empty", async () => {
    const user = userEvent.setup()
    render(
      <FieldTooltip description="">Label</FieldTooltip>,
    )

    await user.click(screen.getByText("Label"))

    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
