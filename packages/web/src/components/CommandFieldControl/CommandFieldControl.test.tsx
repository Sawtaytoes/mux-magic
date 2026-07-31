import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import { CommandFieldControl } from "./CommandFieldControl"

afterEach(() => {
  cleanup()
})

describe("CommandFieldControl", () => {
  test("names the control with the field label", () => {
    render(
      <CommandFieldControl
        field={{ label: "Filename", name: "filename" }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    expect(
      screen.getByRole("textbox", { name: "Filename" }),
    ).toBeVisible()
  })

  test("falls back to the field name when there is no label", () => {
    render(
      <CommandFieldControl field={{ name: "outputPath" }}>
        <input type="text" />
      </CommandFieldControl>,
    )

    expect(
      screen.getByRole("textbox", { name: "outputPath" }),
    ).toBeVisible()
  })

  // The bug this component exists for. `FieldLabel` wrote
  // `htmlFor={`${stepId}-${field.name}`}` and trusted its caller to render
  // an element with that id; eight of sixteen callers did not, so the label
  // resolved to nothing and the control was announced unnamed. Here the id
  // is generated once and cloned onto the control, so the pair cannot drift.
  test("the label's htmlFor resolves to the control it labels", () => {
    render(
      <CommandFieldControl
        field={{ label: "Filename", name: "filename" }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    const control = screen.getByRole("textbox")
    const label = screen.getByText("Filename")

    expect(label.closest("label")).toHaveAttribute(
      "for",
      control.id,
    )
    expect(control.id).not.toBe("")
  })

  test("marks the control required, not just the asterisk", () => {
    render(
      <CommandFieldControl
        field={{
          isRequired: true,
          label: "Filename",
          name: "filename",
        }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    expect(screen.getByText("*")).toBeVisible()
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("omits the asterisk when the field is optional", () => {
    render(
      <CommandFieldControl
        field={{ label: "Filename", name: "filename" }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    expect(screen.queryByText("*")).toBeNull()
    expect(screen.getByRole("textbox")).not.toBeRequired()
  })

  test("renders no tooltip until the control is reached", () => {
    render(
      <CommandFieldControl
        field={{
          description: "Where the output goes.",
          label: "Filename",
          name: "filename",
        }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  // `FieldTooltip` bound `onPointerEnter`/`onPointerLeave` and no `onFocus`,
  // so a keyboard user could not open it at all — WCAG 2.1.1 on the one
  // place a field's explanation lived.
  test("opens the description on focus and describes the control", async () => {
    const user = userEvent.setup()

    render(
      <CommandFieldControl
        field={{
          description: "Where the output goes.",
          label: "Filename",
          name: "filename",
        }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    await user.tab()

    const tooltip = await screen.findByRole("tooltip")

    expect(tooltip).toHaveTextContent(
      "Where the output goes.",
    )
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-describedby",
      tooltip.id,
    )
  })

  // WCAG 1.4.13. `FieldTooltip` had no key handling at all.
  test("Escape dismisses the description", async () => {
    const user = userEvent.setup()

    render(
      <CommandFieldControl
        field={{
          description: "Where the output goes.",
          label: "Filename",
          name: "filename",
        }}
      >
        <input type="text" />
      </CommandFieldControl>,
    )

    await user.tab()
    await screen.findByRole("tooltip")

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
