import { render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import { describe, expect, it } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { PathField } from "./PathField"

const createTestStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "test-step-1",
  alias: "",
  command: "makeDirectory",
  params: { filePath: "/test/path" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

describe("PathField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]

  it("renders input with current value", () => {
    const step = createTestStep({
      params: { filePath: "/home/user" },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByDisplayValue("/home/user")
    expect(input).toBeInTheDocument()
  })

  it("shows browse button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const browseButton = screen.getByTitle(/browse/i)
    expect(browseButton).toBeInTheDocument()
  })

  it("shows link button with custom label when no link", () => {
    const step = createTestStep()
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText("— custom —"),
    ).toBeInTheDocument()
  })

  it("shows link button with path var label when linked to path var", () => {
    const step = createTestStep({
      links: { filePath: "basePath" },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const button = screen.getByRole("button", {
      name: /basePath/i,
    })
    expect(button).toBeInTheDocument()
  })

  it("makes input readonly when linked to step output", () => {
    const step = createTestStep({
      links: {
        filePath: { linkedTo: "step-1", output: "folder" },
      },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("readonly")
  })
})
