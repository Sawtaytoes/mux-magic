import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ComputeFromEditor } from "./ComputeFromEditor"
import { StyleFieldRow } from "./StyleFieldRow"
import type { ComputeFrom, DslRule } from "./types"

afterEach(() => {
  cleanup()
})

const makeSetStyleFieldsRules = (
  fieldKey: string,
  fieldValue: unknown,
): DslRule[] => [
  {
    type: "setStyleFields",
    fields: { [fieldKey]: fieldValue as string },
  },
]

// ─── B14: StyleFieldRow "Field" trigger opens STYLE_FIELDS picker ─────────────

describe("StyleFieldRow — field key autocomplete (B14)", () => {
  it("renders the field key as a clickable trigger button", () => {
    const rules = makeSetStyleFieldsRules(
      "Fontname",
      "Arial",
    )
    render(
      <StyleFieldRow
        rules={rules}
        ruleIndex={0}
        fieldKey="Fontname"
        fieldValue="Arial"
        isReadOnly={false}
        onCommitRules={vi.fn()}
      />,
    )
    expect(
      screen.getByRole("button", { name: /Fontname/i }),
    ).toBeInTheDocument()
  })

  it("clicking the field key trigger reveals Fontname as a dropdown option", async () => {
    const user = userEvent.setup()
    const rules = makeSetStyleFieldsRules(
      "Fontname",
      "Arial",
    )
    render(
      <StyleFieldRow
        rules={rules}
        ruleIndex={0}
        fieldKey="Fontname"
        fieldValue="Arial"
        isReadOnly={false}
        onCommitRules={vi.fn()}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /Fontname/i,
    })
    await user.click(trigger)
    expect(
      screen.getByRole("option", { name: "Fontname" }),
    ).toBeInTheDocument()
  })

  it("clicking a STYLE_FIELDS option commits the renamed field", async () => {
    const user = userEvent.setup()
    const rules = makeSetStyleFieldsRules("Field1", "")
    const onCommitRules = vi.fn()
    render(
      <StyleFieldRow
        rules={rules}
        ruleIndex={0}
        fieldKey="Field1"
        fieldValue=""
        isReadOnly={false}
        onCommitRules={onCommitRules}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /Field1/i,
    })
    await user.click(trigger)
    const option = screen.getByRole("option", {
      name: "PrimaryColour",
    })
    await user.click(option)
    expect(onCommitRules).toHaveBeenCalled()
    const nextRules = onCommitRules.mock
      .calls[0][0] as DslRule[]
    const fields = (
      nextRules[0] as { fields: Record<string, unknown> }
    ).fields
    expect(Object.keys(fields)).toContain("PrimaryColour")
  })

  it("does not open the picker when isReadOnly", async () => {
    const user = userEvent.setup()
    const rules = makeSetStyleFieldsRules(
      "Fontname",
      "Arial",
    )
    render(
      <StyleFieldRow
        rules={rules}
        ruleIndex={0}
        fieldKey="Fontname"
        fieldValue="Arial"
        isReadOnly={true}
        onCommitRules={vi.fn()}
      />,
    )
    const trigger = screen.queryByRole("button", {
      name: /Fontname/i,
    })
    if (trigger) {
      await user.click(trigger)
    }
    expect(
      screen.queryByRole("option", { name: "Fontname" }),
    ).not.toBeInTheDocument()
  })
})

// ─── B14: ComputeFromEditor "property" trigger scope-aware options ─────────────

const makeComputeFrom = (
  scope: "scriptInfo" | "style",
): ComputeFrom => ({
  property: "",
  scope,
  ops: [],
})

const makeComputedRules = (
  scope: "scriptInfo" | "style",
): DslRule[] => [
  {
    type: "setStyleFields",
    fields: {
      Fontsize: { computeFrom: makeComputeFrom(scope) },
    },
  },
]

describe("ComputeFromEditor — property autocomplete (B14)", () => {
  it("clicking the property trigger with scope=scriptInfo shows PlayResY", async () => {
    const user = userEvent.setup()
    render(
      <ComputeFromEditor
        rules={makeComputedRules("scriptInfo")}
        ruleIndex={0}
        fieldKey="Fontsize"
        computeFrom={makeComputeFrom("scriptInfo")}
        isReadOnly={false}
        onCommitRules={vi.fn()}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /property/i,
    })
    await user.click(trigger)
    expect(
      screen.getByRole("option", { name: "PlayResY" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", {
        name: "PrimaryColour",
      }),
    ).not.toBeInTheDocument()
  })

  it("clicking the property trigger with scope=style shows PrimaryColour", async () => {
    const user = userEvent.setup()
    render(
      <ComputeFromEditor
        rules={makeComputedRules("style")}
        ruleIndex={0}
        fieldKey="Fontsize"
        computeFrom={makeComputeFrom("style")}
        isReadOnly={false}
        onCommitRules={vi.fn()}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /property/i,
    })
    await user.click(trigger)
    expect(
      screen.getByRole("option", { name: "PrimaryColour" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "PlayResY" }),
    ).not.toBeInTheDocument()
  })

  it("selecting a property option commits the value", async () => {
    const user = userEvent.setup()
    const onCommitRules = vi.fn()
    render(
      <ComputeFromEditor
        rules={makeComputedRules("scriptInfo")}
        ruleIndex={0}
        fieldKey="Fontsize"
        computeFrom={makeComputeFrom("scriptInfo")}
        isReadOnly={false}
        onCommitRules={onCommitRules}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /property/i,
    })
    await user.click(trigger)
    const option = screen.getByRole("option", {
      name: "PlayResY",
    })
    await user.click(option)
    expect(onCommitRules).toHaveBeenCalled()
    const nextRules = onCommitRules.mock
      .calls[0][0] as DslRule[]
    const fieldValue = (
      nextRules[0] as unknown as {
        fields: { Fontsize: { computeFrom: ComputeFrom } }
      }
    ).fields.Fontsize.computeFrom
    expect(fieldValue.property).toBe("PlayResY")
  })

  it("typing a custom property value not in the list still saves correctly", async () => {
    const user = userEvent.setup()
    const onCommitRules = vi.fn()
    render(
      <ComputeFromEditor
        rules={makeComputedRules("scriptInfo")}
        ruleIndex={0}
        fieldKey="Fontsize"
        computeFrom={makeComputeFrom("scriptInfo")}
        isReadOnly={false}
        onCommitRules={onCommitRules}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /property/i,
    })
    await user.click(trigger)
    const input = screen.getByRole("textbox")
    await user.type(input, "CustomProp")
    await user.keyboard("{Enter}")
    expect(onCommitRules).toHaveBeenCalled()
    const nextRules = onCommitRules.mock
      .calls[0][0] as DslRule[]
    const fieldValue = (
      nextRules[0] as unknown as {
        fields: { Fontsize: { computeFrom: ComputeFrom } }
      }
    ).fields.Fontsize.computeFrom
    expect(fieldValue.property).toBe("CustomProp")
  })
})
