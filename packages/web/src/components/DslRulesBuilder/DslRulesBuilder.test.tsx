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
  readIsAspectLinked,
  removeRule,
  setScaleResolutionAspectLink,
  setScaleResolutionDimension,
  setScaleResolutionToDimensionLinked,
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

// ─── readIsAspectLinked + legacy migration ────────────────────────────────────

describe("readIsAspectLinked", () => {
  it("returns true when no flags are set (default-on)", () => {
    const rule = {
      type: "scaleResolution" as const,
      from: { width: 1920, height: 1080 },
      to: { width: 1280, height: 720 },
    }
    expect(readIsAspectLinked(rule)).toBe(true)
  })

  it("returns false when isAspectLinked is false", () => {
    const rule = {
      type: "scaleResolution" as const,
      from: { width: 1920, height: 1080 },
      to: { width: 1280, height: 720 },
      isAspectLinked: false,
    }
    expect(readIsAspectLinked(rule)).toBe(false)
  })

  it("returns false when legacy isFromAspectLocked is false", () => {
    const rule = {
      type: "scaleResolution" as const,
      from: { width: 1920, height: 1080 },
      to: { width: 1280, height: 720 },
      isFromAspectLocked: false,
    }
    expect(readIsAspectLinked(rule)).toBe(false)
  })

  it("returns false when legacy isToAspectLocked is false", () => {
    const rule = {
      type: "scaleResolution" as const,
      from: { width: 1920, height: 1080 },
      to: { width: 1280, height: 720 },
      isToAspectLocked: false,
    }
    expect(readIsAspectLinked(rule)).toBe(false)
  })
})

// ─── setScaleResolutionAspectLink ─────────────────────────────────────────────

describe("setScaleResolutionAspectLink", () => {
  it("marks unlinked by writing isAspectLinked=false and drops legacy keys", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
        isFromAspectLocked: false,
        isToAspectLocked: false,
      },
    ]
    const result = setScaleResolutionAspectLink({
      rules,
      ruleIndex: 0,
      isLinked: false,
    })
    const updated = result[0] as Record<string, unknown>
    expect(updated.isAspectLinked).toBe(false)
    expect(
      Object.hasOwn(updated, "isFromAspectLocked"),
    ).toBe(false)
    expect(Object.hasOwn(updated, "isToAspectLocked")).toBe(
      false,
    )
  })

  it("relinking deletes isAspectLinked key (default-on omission) and drops legacy keys", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
        isAspectLinked: false,
        isFromAspectLocked: false,
      },
    ]
    const result = setScaleResolutionAspectLink({
      rules,
      ruleIndex: 0,
      isLinked: true,
    })
    const updated = result[0] as Record<string, unknown>
    expect(Object.hasOwn(updated, "isAspectLinked")).toBe(
      false,
    )
    expect(
      Object.hasOwn(updated, "isFromAspectLocked"),
    ).toBe(false)
  })
})

// ─── setScaleResolutionToDimensionLinked ──────────────────────────────────────

describe("setScaleResolutionToDimensionLinked", () => {
  it("preserves from aspect (2.4:1) when editing to.width — not to's own prior ratio", () => {
    // This is the regression test: from is 1920×800 (2.4:1), to is 1280×720 (16:9).
    // Editing to.width=3840 while linked should give to.height=1600 (from's 2.4:1),
    // NOT 2160 (to's own 16:9).
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 800 },
        to: { width: 1280, height: 720 },
      },
    ]
    const result = setScaleResolutionToDimensionLinked({
      rules,
      ruleIndex: 0,
      dimension: "width",
      value: 3840,
    })
    const updated = result[0] as {
      to: { width: number; height: number }
      from: { width: number; height: number }
    }
    expect(updated.to.width).toBe(3840)
    expect(updated.to.height).toBe(1600)
    // from must be untouched
    expect(updated.from.width).toBe(1920)
    expect(updated.from.height).toBe(800)
  })

  it("preserves from aspect when editing to.height", () => {
    // from is 1920×800 (2.4:1); editing to.height=800 → to.width=1920
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 800 },
        to: { width: 1280, height: 720 },
      },
    ]
    const result = setScaleResolutionToDimensionLinked({
      rules,
      ruleIndex: 0,
      dimension: "height",
      value: 800,
    })
    const updated = result[0] as {
      to: { width: number; height: number }
    }
    expect(updated.to.height).toBe(800)
    expect(updated.to.width).toBe(1920)
  })

  it("falls back to 16:9 when from dims are 0x0", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 0, height: 0 },
        to: { width: 0, height: 0 },
      },
    ]
    const result = setScaleResolutionToDimensionLinked({
      rules,
      ruleIndex: 0,
      dimension: "width",
      value: 1920,
    })
    const updated = result[0] as {
      to: { width: number; height: number }
    }
    expect(updated.to.width).toBe(1920)
    expect(updated.to.height).toBe(1080)
  })

  it("strips legacy aspect keys on write", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
        isFromAspectLocked: false,
        isToAspectLocked: false,
      },
    ]
    const result = setScaleResolutionToDimensionLinked({
      rules,
      ruleIndex: 0,
      dimension: "width",
      value: 3840,
    })
    const updated = result[0] as Record<string, unknown>
    expect(
      Object.hasOwn(updated, "isFromAspectLocked"),
    ).toBe(false)
    expect(Object.hasOwn(updated, "isToAspectLocked")).toBe(
      false,
    )
  })
})

// ─── from.* edit while linked — must be free (no to.* side-effects) ──────────

describe("setScaleResolutionDimension for from group", () => {
  it("editing from.width while linked does NOT touch to.*", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
      },
    ]
    const result = setScaleResolutionDimension({
      rules,
      ruleIndex: 0,
      group: "from",
      dimension: "width",
      value: 3840,
    })
    const updated = result[0] as {
      from: { width: number; height: number }
      to: { width: number; height: number }
    }
    expect(updated.from.width).toBe(3840)
    // to must be untouched
    expect(updated.to.width).toBe(1280)
    expect(updated.to.height).toBe(720)
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
    const { container } = render(
      <Provider>
        <DslRulesBuilder
          step={createStep({
            rules: parityRules,
            hasDefaultRules: true,
          })}
        />
      </Provider>,
    )
    // Old-format rules aren't recognized by the new dispatcher; the
    // component should still mount cleanly (regression guard for the
    // pre-W2.5 fixture shape). `hasDefaultRules` was moved out to
    // SubtitleRulesField; assert here that the legacy checkbox label
    // is no longer rendered inside DslRulesBuilder.
    expect(container.firstChild).toBeInTheDocument()
    expect(
      screen.queryByText("hasDefaultRules"),
    ).not.toBeInTheDocument()
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

  it("renders exactly one aspect link button (linked by default)", () => {
    const rules: DslRule[] = [
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
    const linkButtons = screen.getAllByRole("button", {
      name: /aspect/i,
    })
    expect(linkButtons).toHaveLength(1)
    expect(linkButtons[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("reflects unlinked state when isAspectLinked is false", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
        isAspectLinked: false,
      },
    ]
    render(
      <Provider>
        <DslRulesBuilder step={createStep({ rules })} />
      </Provider>,
    )
    const linkButton = screen.getByRole("button", {
      name: /aspect/i,
    })
    expect(linkButton).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("reflects unlinked state when legacy isFromAspectLocked is false", () => {
    const rules: DslRule[] = [
      {
        type: "scaleResolution",
        from: { width: 1920, height: 1080 },
        to: { width: 1280, height: 720 },
        isFromAspectLocked: false,
      },
    ]
    render(
      <Provider>
        <DslRulesBuilder step={createStep({ rules })} />
      </Provider>,
    )
    const linkButton = screen.getByRole("button", {
      name: /aspect/i,
    })
    expect(linkButton).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })
})
