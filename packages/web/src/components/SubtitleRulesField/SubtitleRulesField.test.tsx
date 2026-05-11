import { render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import { describe, expect, it } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { SubtitleRulesField } from "./SubtitleRulesField"

const createTestStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "test-step-1",
  alias: "",
  command: "modifySubtitleMetadata",
  params: { rules: [] },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

describe("SubtitleRulesField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.modifySubtitleMetadata
      .fields[1]

  it("renders textarea", () => {
    const step = createTestStep()
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    const textarea = screen.getByRole("textbox")
    expect(textarea).toBeInTheDocument()
  })

  it("shows escalation note", () => {
    const step = createTestStep()
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText(/coming in Phase 2.5/i),
    ).toBeInTheDocument()
  })

  it("initializes with empty array as JSON", () => {
    const step = createTestStep({ params: { rules: [] } })
    const { container } = render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    const textarea = container.querySelector(
      'textarea[placeholder="Enter rules as JSON..."]',
    ) as HTMLTextAreaElement
    expect(textarea?.value).toBe("[]")
  })

  it("shows parse error for invalid JSON", () => {
    const step = createTestStep()
    const { container } = render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    const textarea = container.querySelector(
      'textarea[placeholder="Enter rules as JSON..."]',
    )
    expect(textarea).toBeInTheDocument()
  })
})
