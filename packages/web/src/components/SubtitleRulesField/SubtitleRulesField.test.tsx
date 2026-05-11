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

  it("renders the visual rules builder", () => {
    const step = createTestStep()
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText("hasDefaultRules"),
    ).toBeInTheDocument()
  })

  it("shows empty state when no rules are configured", () => {
    const step = createTestStep({ params: { rules: [] } })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText(/no rules yet/i),
    ).toBeInTheDocument()
  })

  it("renders a rule card when a rule exists", () => {
    const step = createTestStep({
      params: {
        rules: [
          {
            type: "setScriptInfo",
            key: "Title",
            value: "Test",
          },
        ],
      },
    })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByDisplayValue("setScriptInfo"),
    ).toBeInTheDocument()
  })
})
