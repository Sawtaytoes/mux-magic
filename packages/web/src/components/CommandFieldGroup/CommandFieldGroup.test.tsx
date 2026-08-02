import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import { CommandFieldGroup } from "./CommandFieldGroup"

afterEach(() => {
  cleanup()
})

describe("CommandFieldGroup", () => {
  test("names the group with the field label", () => {
    render(
      <CommandFieldGroup
        field={{ label: "Rename rules", name: "rules" }}
      >
        <input aria-label="Pattern" type="text" />
        <input aria-label="Flags" type="text" />
      </CommandFieldGroup>,
    )

    expect(
      screen.getByRole("group", { name: "Rename rules" }),
    ).toBeVisible()
  })

  test("falls back to the field name when there is no label", () => {
    render(
      <CommandFieldGroup field={{ name: "renameRegex" }}>
        <input aria-label="Pattern" type="text" />
      </CommandFieldGroup>,
    )

    expect(
      screen.getByRole("group", { name: "renameRegex" }),
    ).toBeVisible()
  })

  test("renders the actions slot beside the label", () => {
    render(
      <CommandFieldGroup
        actions={<button type="button">Show as /…/</button>}
        field={{ label: "Rename rules", name: "rules" }}
      >
        <input aria-label="Pattern" type="text" />
      </CommandFieldGroup>,
    )

    expect(
      screen.getByRole("button", { name: "Show as /…/" }),
    ).toBeVisible()
  })

  test("shows the required asterisk without announcing it", () => {
    render(
      <CommandFieldGroup
        field={{
          isRequired: true,
          label: "Rename rules",
          name: "rules",
        }}
      >
        <input aria-label="Pattern" type="text" />
      </CommandFieldGroup>,
    )

    expect(screen.getByText("*")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
    expect(
      screen.getByRole("group", { name: "Rename rules" }),
    ).toBeVisible()
  })

  test("renders no help trigger when the field has no description", () => {
    render(
      <CommandFieldGroup
        field={{ label: "Rename rules", name: "rules" }}
      >
        <input aria-label="Pattern" type="text" />
      </CommandFieldGroup>,
    )

    expect(
      screen.queryByRole("button", {
        name: "About Rename rules",
      }),
    ).toBeNull()
  })

  // The help affordance is a real `<button>` here — which it cannot be
  // inside `Field`, because `<label>` forbids labelable descendants and a
  // button inside one also activates the labelled control on click.
  test("the description opens from the keyboard and is dismissible", async () => {
    const user = userEvent.setup()

    render(
      <CommandFieldGroup
        field={{
          description: "Applied left to right.",
          label: "Rename rules",
          name: "rules",
        }}
      >
        <input aria-label="Pattern" type="text" />
      </CommandFieldGroup>,
    )

    await user.tab()

    expect(
      screen.getByRole("button", {
        name: "About Rename rules",
      }),
    ).toHaveFocus()

    const tooltip = await screen.findByRole("tooltip")

    expect(tooltip).toHaveTextContent(
      "Applied left to right.",
    )

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("tooltip")).toBeNull()
  })
})
