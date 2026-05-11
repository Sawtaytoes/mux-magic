import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it } from "vitest"

import type { Step } from "../../types"
import {
  addApplyIfClause,
  addWhenClause,
  removeApplyIfClause,
  removeWhenClause,
} from "./conditionMutations"
import { DslRulesBuilder } from "./DslRulesBuilder"
import {
  addRule,
  changeRuleType,
  moveRule,
  removeRule,
  setScaleResolutionDimension,
  setScriptInfoField,
} from "./ruleMutations"
import {
  addStyleField,
  removeStyleField,
} from "./styleMutations"
import type { DslRule } from "./types"

// ─── Mutation unit tests (pure, no React) ─────────────────────────────────────

describe("addRule", () => {
  it("appends a setScriptInfo rule by default", () => {
    const result = addRule({ rules: [] })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("setScriptInfo")
  })

  it("appends a scaleResolution rule when specified", () => {
    const result = addRule({
      rules: [],
      ruleType: "scaleResolution",
    })
    expect(result[0].type).toBe("scaleResolution")
  })

  it("inserts at the specified index", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "A", value: "" },
      { type: "setScriptInfo", key: "B", value: "" },
    ]
    const result = addRule({
      rules,
      ruleType: "setStyleFields",
      insertIndex: 1,
    })
    expect(result).toHaveLength(3)
    expect(result[1].type).toBe("setStyleFields")
    expect((result[0] as { key: string }).key).toBe("A")
    expect((result[2] as { key: string }).key).toBe("B")
  })
})

describe("removeRule", () => {
  it("removes the rule at the given index", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "A", value: "" },
      { type: "setScriptInfo", key: "B", value: "" },
    ]
    const result = removeRule({ rules, ruleIndex: 0 })
    expect(result).toHaveLength(1)
    expect((result[0] as { key: string }).key).toBe("B")
  })

  it("returns original array for out-of-range index", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "A", value: "" },
    ]
    const result = removeRule({ rules, ruleIndex: 5 })
    expect(result).toHaveLength(1)
  })
})

describe("moveRule", () => {
  it("moves a rule down by 1", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "A", value: "" },
      { type: "setScriptInfo", key: "B", value: "" },
    ]
    const result = moveRule({
      rules,
      ruleIndex: 0,
      direction: 1,
    })
    expect((result[0] as { key: string }).key).toBe("B")
    expect((result[1] as { key: string }).key).toBe("A")
  })

  it("no-ops when moving the first rule up", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "A", value: "" },
      { type: "setScriptInfo", key: "B", value: "" },
    ]
    const result = moveRule({
      rules,
      ruleIndex: 0,
      direction: -1,
    })
    expect(result).toBe(rules)
  })
})

describe("changeRuleType", () => {
  it("replaces the rule with an empty rule of the new type", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "X", value: "Y" },
    ]
    const result = changeRuleType({
      rules,
      ruleIndex: 0,
      ruleType: "setStyleFields",
    })
    expect(result[0].type).toBe("setStyleFields")
    expect(
      (result[0] as { key?: string }).key,
    ).toBeUndefined()
  })
})

describe("setScriptInfoField", () => {
  it("updates the key field", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "Old", value: "" },
    ]
    const result = setScriptInfoField({
      rules,
      ruleIndex: 0,
      fieldName: "key",
      value: "New",
    })
    expect((result[0] as { key: string }).key).toBe("New")
  })

  it("updates the value field", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "", value: "Old" },
    ]
    const result = setScriptInfoField({
      rules,
      ruleIndex: 0,
      fieldName: "value",
      value: "New",
    })
    expect((result[0] as { value: string }).value).toBe(
      "New",
    )
  })
})

describe("setScaleResolutionDimension", () => {
  it("updates from.width", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 0, height: 0 },
        to: { width: 0, height: 0 },
      },
    ]
    const result = setScaleResolutionDimension({
      rules,
      ruleIndex: 0,
      group: "from",
      dimension: "width",
      value: 1920,
    })
    expect(
      (result[0] as { from: { width: number } }).from.width,
    ).toBe(1920)
  })
})

describe("when mutations", () => {
  it("adds and removes a when clause", () => {
    const rules: DslRule[] = [
      { type: "setScriptInfo", key: "", value: "" },
    ]
    const withClause = addWhenClause({
      rules,
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    expect(
      (withClause[0] as { when?: object }).when,
    ).toBeDefined()
    const withoutClause = removeWhenClause({
      rules: withClause,
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    expect(
      (withoutClause[0] as { when?: object }).when,
    ).toBeUndefined()
  })
})

describe("applyIf mutations", () => {
  it("adds and removes an applyIf clause", () => {
    const rules: DslRule[] = [
      { type: "setStyleFields", fields: {} },
    ]
    const withClause = addApplyIfClause({
      rules,
      ruleIndex: 0,
      clauseName: "anyStyleMatches",
    })
    expect(
      (withClause[0] as { applyIf?: object }).applyIf,
    ).toBeDefined()
    const withoutClause = removeApplyIfClause({
      rules: withClause,
      ruleIndex: 0,
      clauseName: "anyStyleMatches",
    })
    expect(
      (withoutClause[0] as { applyIf?: object }).applyIf,
    ).toBeUndefined()
  })
})

describe("style field mutations", () => {
  it("adds and removes a style field", () => {
    const rules: DslRule[] = [
      { type: "setStyleFields", fields: {} },
    ]
    const withField = addStyleField({ rules, ruleIndex: 0 })
    expect(
      Object.keys(
        (withField[0] as { fields: object }).fields,
      ),
    ).toHaveLength(1)
    const firstKey = Object.keys(
      (withField[0] as { fields: Record<string, unknown> })
        .fields,
    )[0]
    const withoutField = removeStyleField({
      rules: withField,
      ruleIndex: 0,
      fieldKey: firstKey,
    })
    expect(
      Object.keys(
        (withoutField[0] as { fields: object }).fields,
      ),
    ).toHaveLength(0)
  })
})

// ─── Round-trip parity check ──────────────────────────────────────────────────

const createStep = (
  paramsOverride?: Record<string, unknown>,
): Step => ({
  id: "parity-step",
  alias: "",
  command: "modifySubtitleMetadata",
  params: paramsOverride ?? { rules: [] },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

afterEach(() => {
  cleanup()
})

describe("DslRulesBuilder render", () => {
  it("mounts without error for empty rules", () => {
    render(
      <Provider>
        <DslRulesBuilder step={createStep()} />
      </Provider>,
    )
    expect(
      screen.getByText(/no rules yet/i),
    ).toBeInTheDocument()
  })

  it("mounts without error for old-format parity fixture rules", () => {
    const parityRules = [
      {
        match: {
          field: "Name",
          op: "eq",
          value: "Default",
        },
        actions: [{ field: "ScaleX", value: "1.0" }],
      },
    ]
    render(
      <Provider>
        <DslRulesBuilder
          step={createStep({
            rules: parityRules,
            hasDefaultRules: true,
          })}
        />
      </Provider>,
    )
    expect(
      screen.getByText("hasDefaultRules"),
    ).toBeInTheDocument()
  })

  it("renders a rule card for each DSL rule", () => {
    const rules: DslRule[] = [
      {
        type: "setScriptInfo",
        key: "Title",
        value: "Test",
      },
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
      },
    ]
    render(
      <Provider>
        <DslRulesBuilder step={createStep({ rules })} />
      </Provider>,
    )
    expect(
      screen.getByDisplayValue("setScriptInfo"),
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("scaleResolution"),
    ).toBeInTheDocument()
  })
})
