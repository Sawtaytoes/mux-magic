import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

// Tests for the structured DSL rules form-builder. The module reads
// `window.mediaTools.findStepById` to locate the editing step and
// `window.mediaTools.renderAll` to schedule a re-render after every
// mutation. We mock both with an in-memory step store so the tests can
// assert on the resulting `step.params` shape — that shape is what
// goes into the YAML (round-tripped through stepToYaml + buildParams in
// the existing yaml-modal pipeline).

type StepLike = {
  id: string
  alias: string
  command: string | null
  params: Record<string, unknown>
  links: Record<string, unknown>
  status: null
  error: null
  isCollapsed: boolean
}

type MediaToolsMock = {
  findStepById: (id: string) => StepLike | null
  renderAll: ReturnType<typeof vi.fn>
}

declare global {
  interface Window {
    mediaTools: MediaToolsMock
  }
}

let stepUnderTest: StepLike

function makeStep(initialParams: Record<string, unknown> = {}): StepLike {
  return {
    id: "step1",
    alias: "",
    command: "modifySubtitleMetadata",
    params: { ...initialParams },
    links: {},
    status: null,
    error: null,
    isCollapsed: false,
  }
}

beforeEach(() => {
  stepUnderTest = makeStep()
  ;(window as Window).mediaTools = {
    findStepById: (id: string) => (id === stepUnderTest.id ? stepUnderTest : null),
    renderAll: vi.fn(),
  }
})

afterEach(() => {
  delete (window as { mediaTools?: unknown }).mediaTools
})

describe("normalizeWhenClause + compactWhenClause", () => {
  test("normalizes shorthand (bare key map) to canonical { matches }", async () => {
    const { normalizeWhenClause } = await import("./dsl-rules-builder.js")
    const canonical = normalizeWhenClause({ "YCbCr Matrix": "TV.601" })
    expect(canonical).toEqual({
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: null,
    })
  })

  test("normalizes explicit form preserving matches + excludes", async () => {
    const { normalizeWhenClause } = await import("./dsl-rules-builder.js")
    const input = {
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: { $ref: "isSdDvd" },
    }
    expect(normalizeWhenClause(input)).toEqual({
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: { $ref: "isSdDvd" },
    })
  })

  test("compactWhenClause collapses matches-only literal back to shorthand", async () => {
    const { compactWhenClause } = await import("./dsl-rules-builder.js")
    expect(compactWhenClause({
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: null,
    })).toEqual({ "YCbCr Matrix": "TV.601" })
  })

  test("compactWhenClause keeps explicit form when excludes is set", async () => {
    const { compactWhenClause } = await import("./dsl-rules-builder.js")
    expect(compactWhenClause({
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: { $ref: "isSdDvd" },
    })).toEqual({
      matches: { "YCbCr Matrix": "TV.601" },
      excludes: { $ref: "isSdDvd" },
    })
  })

  test("compactWhenClause keeps explicit form when matches is a $ref", async () => {
    const { compactWhenClause } = await import("./dsl-rules-builder.js")
    expect(compactWhenClause({
      matches: { $ref: "isFansubRelease" },
      excludes: null,
    })).toEqual({ matches: { $ref: "isFansubRelease" } })
  })

  test("compactWhenClause returns null when both slots are empty", async () => {
    const { compactWhenClause } = await import("./dsl-rules-builder.js")
    expect(compactWhenClause({ matches: {}, excludes: null })).toBeNull()
  })
})

describe("rules list mutations", () => {
  test("addRule with no insertIndex appends a fresh setScriptInfo rule", async () => {
    const { addRule } = await import("./dsl-rules-builder.js")
    addRule({ stepId: "step1", ruleType: "setScriptInfo" })
    expect(stepUnderTest.params.rules).toEqual([
      { type: "setScriptInfo", key: "", value: "" },
    ])
  })

  test("addRule with insertIndex 0 prepends to the list", async () => {
    const { addRule } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    addRule({ stepId: "step1", ruleType: "scaleResolution", insertIndex: 0 })
    expect(Array.isArray(stepUnderTest.params.rules)).toBe(true)
    const rules = stepUnderTest.params.rules as { type: string }[]
    expect(rules[0].type).toBe("scaleResolution")
    expect(rules[1].type).toBe("setScriptInfo")
  })

  test("removeRule deletes the params.rules key when emptied", async () => {
    const { removeRule } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    removeRule({ stepId: "step1", ruleIndex: 0 })
    expect(stepUnderTest.params.rules).toBeUndefined()
  })

  test("moveRule swaps indexes in the requested direction", async () => {
    const { moveRule } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "A", value: "1" },
      { type: "setScriptInfo", key: "B", value: "2" },
      { type: "setScriptInfo", key: "C", value: "3" },
    ]
    moveRule({ stepId: "step1", ruleIndex: 2, direction: -1 })
    const rules = stepUnderTest.params.rules as { key: string }[]
    expect(rules.map((rule) => rule.key)).toEqual(["A", "C", "B"])
  })

  test("changeRuleType replaces the rule with a fresh shape", async () => {
    const { changeRuleType } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    changeRuleType({
      stepId: "step1",
      ruleIndex: 0,
      ruleType: "scaleResolution",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "scaleResolution",
        from: { width: 0, height: 0 },
        to: { width: 0, height: 0 },
      },
    ])
  })
})

describe("predicates manager mutations", () => {
  test("addPredicate seeds a new empty entry with a unique name", async () => {
    const { addPredicate } = await import("./dsl-rules-builder.js")
    addPredicate({ stepId: "step1" })
    expect(stepUnderTest.params.predicates).toEqual({ predicate: {} })
    addPredicate({ stepId: "step1" })
    expect(stepUnderTest.params.predicates).toEqual({
      predicate: {},
      predicate2: {},
    })
  })

  test("renamePredicate preserves entry order and body", async () => {
    const { renamePredicate } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.predicates = {
      isSdDvd: { "YCbCr Matrix": "TV.601" },
      isHd1080: { PlayResX: "1920" },
    }
    renamePredicate({
      stepId: "step1",
      oldName: "isSdDvd",
      newName: "isStandardDefDvd",
    })
    expect(stepUnderTest.params.predicates).toEqual({
      isStandardDefDvd: { "YCbCr Matrix": "TV.601" },
      isHd1080: { PlayResX: "1920" },
    })
  })

  test("renamePredicate refuses a name collision without mutating", async () => {
    const { renamePredicate } = await import("./dsl-rules-builder.js")
    const initialPredicates = {
      isSdDvd: { "YCbCr Matrix": "TV.601" },
      isHd1080: { PlayResX: "1920" },
    }
    stepUnderTest.params.predicates = { ...initialPredicates }
    renamePredicate({
      stepId: "step1",
      oldName: "isSdDvd",
      newName: "isHd1080",
    })
    expect(stepUnderTest.params.predicates).toEqual(initialPredicates)
  })

  test("removePredicate strips params.predicates entirely when emptied", async () => {
    const { removePredicate } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.predicates = { isSdDvd: {} }
    removePredicate({ stepId: "step1", predicateName: "isSdDvd" })
    expect(stepUnderTest.params.predicates).toBeUndefined()
  })

  test("addPredicateEntry seeds a key→value row", async () => {
    const { addPredicateEntry } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.predicates = { isSdDvd: {} }
    addPredicateEntry({ stepId: "step1", predicateName: "isSdDvd" })
    expect(stepUnderTest.params.predicates).toEqual({
      isSdDvd: { key: "" },
    })
  })

  test("setPredicateEntryKey preserves order during rename", async () => {
    const { setPredicateEntryKey } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.predicates = {
      isSdDvd: {
        "YCbCr Matrix": "TV.601",
        PlayResX: "640",
        PlayResY: "480",
      },
    }
    setPredicateEntryKey({
      stepId: "step1",
      predicateName: "isSdDvd",
      oldKey: "PlayResX",
      newKey: "PlayResWidth",
    })
    expect(
      Object.keys((stepUnderTest.params.predicates as Record<string, unknown>).isSdDvd as Record<string, unknown>),
    ).toEqual(["YCbCr Matrix", "PlayResWidth", "PlayResY"])
  })
})

describe("setStyleFields mutations + computeFrom", () => {
  test("addStyleField seeds an empty literal value", async () => {
    const { addRule, addStyleField } = await import("./dsl-rules-builder.js")
    addRule({ stepId: "step1", ruleType: "setStyleFields" })
    addStyleField({ stepId: "step1", ruleIndex: 0 })
    expect(stepUnderTest.params.rules).toEqual([
      { type: "setStyleFields", fields: { Field: "" } },
    ])
  })

  test("setStyleFieldComputedToggle flips a literal to a computeFrom block", async () => {
    const { setStyleFieldComputedToggle } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setStyleFields", fields: { MarginV: "90" } },
    ]
    setStyleFieldComputedToggle({
      stepId: "step1",
      ruleIndex: 0,
      fieldKey: "MarginV",
      isComputed: true,
    })
    const rules = stepUnderTest.params.rules as Array<{
      fields: Record<string, unknown>
    }>
    expect(rules[0].fields.MarginV).toEqual({
      computeFrom: { property: "", scope: "scriptInfo", ops: [] },
    })
  })

  test("setStyleFieldComputedToggle restores a string when toggling back from literal-known", async () => {
    const { setStyleFieldComputedToggle } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setStyleFields", fields: { MarginV: "90" } },
    ]
    setStyleFieldComputedToggle({
      stepId: "step1",
      ruleIndex: 0,
      fieldKey: "MarginV",
      isComputed: false,
    })
    const rules = stepUnderTest.params.rules as Array<{
      fields: Record<string, unknown>
    }>
    expect(rules[0].fields.MarginV).toBe("90")
  })

  test("computeFrom op verb swap converts numeric op to bare op (and back)", async () => {
    const {
      addRule,
      addStyleField,
      setStyleFieldComputedToggle,
      addComputeFromOp,
      setComputeFromOpVerb,
    } = await import("./dsl-rules-builder.js")
    addRule({ stepId: "step1", ruleType: "setStyleFields" })
    addStyleField({ stepId: "step1", ruleIndex: 0 })
    const fieldKey = Object.keys(
      ((stepUnderTest.params.rules as Array<{ fields: Record<string, unknown> }>)[0]).fields,
    )[0]
    setStyleFieldComputedToggle({
      stepId: "step1",
      ruleIndex: 0,
      fieldKey,
      isComputed: true,
    })
    addComputeFromOp({ stepId: "step1", ruleIndex: 0, fieldKey })
    setComputeFromOpVerb({
      stepId: "step1",
      ruleIndex: 0,
      fieldKey,
      opIndex: 0,
      verb: "round",
    })
    const opsAfterRound = (
      (stepUnderTest.params.rules as Array<{
        fields: Record<string, { computeFrom: { ops: unknown[] } }>
      }>)[0].fields[fieldKey].computeFrom.ops
    )
    expect(opsAfterRound).toEqual(["round"])
    setComputeFromOpVerb({
      stepId: "step1",
      ruleIndex: 0,
      fieldKey,
      opIndex: 0,
      verb: "multiply",
    })
    const opsAfterMultiply = (
      (stepUnderTest.params.rules as Array<{
        fields: Record<string, { computeFrom: { ops: unknown[] } }>
      }>)[0].fields[fieldKey].computeFrom.ops
    )
    expect(opsAfterMultiply).toEqual([{ multiply: 0 }])
  })

  test("setIgnoredStyleNamesRegex strips the key when value is empty", async () => {
    const { setIgnoredStyleNamesRegex } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      {
        type: "setStyleFields",
        fields: { MarginV: "90" },
        ignoredStyleNamesRegexString: "signs?|op|ed",
      },
    ]
    setIgnoredStyleNamesRegex({ stepId: "step1", ruleIndex: 0, value: "" })
    expect(stepUnderTest.params.rules).toEqual([
      { type: "setStyleFields", fields: { MarginV: "90" } },
    ])
  })
})

describe("when builder mutations", () => {
  test("addWhenClause attaches an empty canonical clause to the rule", async () => {
    const { addWhenClause } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    addWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setScriptInfo",
        key: "ScriptType",
        value: "v4.00+",
        when: { anyScriptInfo: { matches: {}, excludes: null } },
      },
    ])
  })

  test("addWhenEntry shorthand-collapses to bare-key form when only matches is set", async () => {
    const { addWhenClause, setWhenEntryKey, setWhenEntryValue } = await import(
      "./dsl-rules-builder.js"
    )
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    addWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    const { addWhenEntry } = await import("./dsl-rules-builder.js")
    addWhenEntry({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
    })
    setWhenEntryKey({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
      oldKey: "key",
      newKey: "YCbCr Matrix",
    })
    setWhenEntryValue({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
      entryKey: "YCbCr Matrix",
      value: "TV.601",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setScriptInfo",
        key: "ScriptType",
        value: "v4.00+",
        when: { anyScriptInfo: { "YCbCr Matrix": "TV.601" } },
      },
    ])
  })

  test("setWhenClauseRef switches a slot to a named-predicate $ref", async () => {
    const { addWhenClause, setWhenClauseRef } = await import(
      "./dsl-rules-builder.js"
    )
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "YCbCr Matrix", value: "TV.709" },
    ]
    addWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    setWhenClauseRef({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "excludes",
      refName: "isSdDvd",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setScriptInfo",
        key: "YCbCr Matrix",
        value: "TV.709",
        when: { anyScriptInfo: { excludes: { $ref: "isSdDvd" } } },
      },
    ])
  })

  test("removeWhenClause peels off the clause and drops empty when blocks", async () => {
    const { addWhenClause, removeWhenClause } = await import(
      "./dsl-rules-builder.js"
    )
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    addWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    removeWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    expect(stepUnderTest.params.rules).toEqual([
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ])
  })
})

describe("applyIf builder mutations", () => {
  test("addApplyIfEntry seeds a numeric eq comparator", async () => {
    const { addApplyIfClause, addApplyIfEntry } = await import(
      "./dsl-rules-builder.js"
    )
    stepUnderTest.params.rules = [
      { type: "setStyleFields", fields: { MarginL: "200" } },
    ]
    addApplyIfClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyStyleMatches",
    })
    addApplyIfEntry({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyStyleMatches",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setStyleFields",
        fields: { MarginL: "200" },
        applyIf: { anyStyleMatches: { Field: { eq: 0 } } },
      },
    ])
  })

  test("setApplyIfEntryComparator preserves the existing operand across verbs", async () => {
    const { setApplyIfEntryComparator } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.rules = [
      {
        type: "setStyleFields",
        fields: { MarginL: "200" },
        applyIf: { anyStyleMatches: { MarginL: { lt: 50 } } },
      },
    ]
    setApplyIfEntryComparator({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyStyleMatches",
      entryKey: "MarginL",
      verb: "gte",
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setStyleFields",
        fields: { MarginL: "200" },
        applyIf: { anyStyleMatches: { MarginL: { gte: 50 } } },
      },
    ])
  })
})

describe("hasDefaultRules toggle", () => {
  test("setHasDefaultRules true persists the flag in step.params", async () => {
    const { setHasDefaultRules } = await import("./dsl-rules-builder.js")
    setHasDefaultRules({ stepId: "step1", isEnabled: true })
    expect(stepUnderTest.params.hasDefaultRules).toBe(true)
  })

  test("setHasDefaultRules false strips the flag from step.params", async () => {
    const { setHasDefaultRules } = await import("./dsl-rules-builder.js")
    stepUnderTest.params.hasDefaultRules = true
    setHasDefaultRules({ stepId: "step1", isEnabled: false })
    expect(stepUnderTest.params.hasDefaultRules).toBeUndefined()
  })
})

describe("renderRulesField output", () => {
  test("emits the dsl-rules-builder container for an empty step", async () => {
    const { renderRulesField } = await import("./dsl-rules-builder.js")
    const html = renderRulesField({ step: stepUnderTest })
    expect(html).toContain("dsl-rules-builder")
    expect(html).toContain("Predicates")
    expect(html).toContain("hasDefaultRules")
  })

  test("renders one editable card per user rule plus a default-rules section when the toggle is on", async () => {
    const { renderRulesField, DEFAULT_RULES_PREVIEW } = await import(
      "./dsl-rules-builder.js"
    )
    stepUnderTest.params.rules = [
      { type: "setScriptInfo", key: "ScriptType", value: "v4.00+" },
    ]
    stepUnderTest.params.hasDefaultRules = true
    const html = renderRulesField({ step: stepUnderTest })
    expect(html).toContain("Default rules")
    expect(html).toContain("readonly")
    // Default rules + the user rule's discriminator should both appear.
    expect(DEFAULT_RULES_PREVIEW.length).toBeGreaterThan(0)
    expect(html.match(/setScriptInfo/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  test("round-trips the canonical Example 2 shape end-to-end", async () => {
    const {
      addPredicate,
      setPredicateEntryKey,
      setPredicateEntryValue,
      addPredicateEntry,
      addRule,
      setScriptInfoField,
      addWhenClause,
      addWhenEntry,
      setWhenEntryKey,
      setWhenEntryValue,
      setWhenClauseRef,
    } = await import("./dsl-rules-builder.js")

    // Build the predicate `isSdDvd: { 'YCbCr Matrix': TV.601, PlayResX: '640', PlayResY: '480' }`.
    addPredicate({ stepId: "step1" })
    addPredicateEntry({ stepId: "step1", predicateName: "predicate" })
    setPredicateEntryKey({
      stepId: "step1",
      predicateName: "predicate",
      oldKey: "key",
      newKey: "YCbCr Matrix",
    })
    setPredicateEntryValue({
      stepId: "step1",
      predicateName: "predicate",
      entryKey: "YCbCr Matrix",
      value: "TV.601",
    })
    // Rename the predicate to its real name.
    const { renamePredicate } = await import("./dsl-rules-builder.js")
    renamePredicate({
      stepId: "step1",
      oldName: "predicate",
      newName: "isSdDvd",
    })

    // Build the rule itself.
    addRule({ stepId: "step1", ruleType: "setScriptInfo" })
    setScriptInfoField({
      stepId: "step1",
      ruleIndex: 0,
      fieldName: "key",
      value: "YCbCr Matrix",
    })
    setScriptInfoField({
      stepId: "step1",
      ruleIndex: 0,
      fieldName: "value",
      value: "TV.709",
    })
    addWhenClause({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
    })
    addWhenEntry({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
    })
    setWhenEntryKey({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
      oldKey: "key",
      newKey: "YCbCr Matrix",
    })
    setWhenEntryValue({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "matches",
      entryKey: "YCbCr Matrix",
      value: "TV.601",
    })
    setWhenClauseRef({
      stepId: "step1",
      ruleIndex: 0,
      clauseName: "anyScriptInfo",
      slot: "excludes",
      refName: "isSdDvd",
    })

    expect(stepUnderTest.params.predicates).toEqual({
      isSdDvd: { "YCbCr Matrix": "TV.601" },
    })
    expect(stepUnderTest.params.rules).toEqual([
      {
        type: "setScriptInfo",
        key: "YCbCr Matrix",
        value: "TV.709",
        when: {
          anyScriptInfo: {
            matches: { "YCbCr Matrix": "TV.601" },
            excludes: { $ref: "isSdDvd" },
          },
        },
      },
    ])
  })
})
