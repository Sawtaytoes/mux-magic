import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
      screen.getByText("Has Default Rules"),
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

  it("renders default rules preview when hasDefaultRules is true", async () => {
    const step = createTestStep({
      params: { rules: [], hasDefaultRules: true },
    })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText(/Default rules/),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: /Default rules/ }),
    )
    expect(
      screen.getAllByText("setScriptInfo").length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText("read-only").length,
    ).toBeGreaterThanOrEqual(1)
  })

  it("hides default rules preview when hasDefaultRules is false", () => {
    const step = createTestStep({
      params: { rules: [], hasDefaultRules: false },
    })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.queryByText(/Default rules/),
    ).not.toBeInTheDocument()
  })

  it("toggle button renders CollapseChevron svg with -rotate-90 when collapsed", async () => {
    const step = createTestStep({
      params: { rules: [], hasDefaultRules: true },
    })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    const toggleButton = screen.getByRole("button", {
      name: /Default rules/,
    })
    // Initially collapsed: svg should have -rotate-90
    const svgCollapsed = toggleButton.querySelector("svg")
    expect(svgCollapsed).not.toBeNull()
    expect(svgCollapsed?.getAttribute("class")).toContain(
      "-rotate-90",
    )

    await userEvent.click(toggleButton)

    // Now expanded: svg should NOT have -rotate-90
    const svgExpanded = toggleButton.querySelector("svg")
    expect(svgExpanded).not.toBeNull()
    expect(
      svgExpanded?.getAttribute("class"),
    ).not.toContain("-rotate-90")
  })

  it("preview section is collapsible", async () => {
    const step = createTestStep({
      params: { rules: [], hasDefaultRules: true },
    })
    render(
      <Provider>
        <SubtitleRulesField field={field} step={step} />
      </Provider>,
    )
    const toggleButton = screen.getByRole("button", {
      name: /Default rules/,
    })
    expect(
      screen.queryByText("read-only"),
    ).not.toBeInTheDocument()

    await userEvent.click(toggleButton)

    expect(
      screen.getAllByText("read-only").length,
    ).toBeGreaterThanOrEqual(1)

    await userEvent.click(toggleButton)

    expect(
      screen.queryByText("read-only"),
    ).not.toBeInTheDocument()
  })
})
