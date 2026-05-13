// ─── Decision 1: Rules union type ────────────────────────────────────────────
// Tagged by `type` field — compiler narrows without runtime branching.

export const RULE_TYPES = [
  "setScriptInfo",
  "scaleResolution",
  "setStyleFields",
] as const

export type RuleType = (typeof RULE_TYPES)[number]

// ─── Decision 3: when/applyIf as structurally separate types ─────────────────
// `when` entries are string→string (or $ref) pairs; `applyIf` entries are
// comparator-operand pairs. Different shapes → different TypeScript types.

export const WHEN_CLAUSE_NAMES = [
  "anyScriptInfo",
  "allScriptInfo",
  "noneScriptInfo",
  "notAllScriptInfo",
  "anyStyle",
  "allStyle",
  "noneStyle",
] as const

export type WhenClauseName =
  (typeof WHEN_CLAUSE_NAMES)[number]

export type RefBody = { $ref: string }
export type WhenSlotValue =
  | Record<string, string>
  | RefBody
  | null

export type WhenClauseCanonical = {
  matches: WhenSlotValue
  excludes: WhenSlotValue
}

export type WhenClauseValue =
  | WhenClauseCanonical
  | Record<string, string>

export type WhenMap = Partial<
  Record<WhenClauseName, WhenClauseValue>
>

export const APPLY_IF_CLAUSE_NAMES = [
  "anyStyleMatches",
  "allStyleMatches",
  "noneStyleMatches",
] as const

export type ApplyIfClauseName =
  (typeof APPLY_IF_CLAUSE_NAMES)[number]

export const COMPARATOR_VERBS = [
  "eq",
  "lt",
  "gt",
  "lte",
  "gte",
] as const

export type ComparatorVerb =
  (typeof COMPARATOR_VERBS)[number]

// eslint-disable-next-line no-restricted-syntax -- DSL builder UI type; not an API shape; "Entry" suffix is a local map-entry concept
export type ApplyIfEntry = {
  [K in ComparatorVerb]?: number
}
export type ApplyIfMap = Partial<
  Record<ApplyIfClauseName, Record<string, ApplyIfEntry>>
>

// ─── Decision 4: computeFrom ops chain — flat array ──────────────────────────
// Flat array preserves serialized YAML shape exactly; avoids a transform layer.

export const COMPUTE_FROM_OPS_WITH_OPERAND = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "min",
  "max",
] as const

export const COMPUTE_FROM_OPS_BARE = [
  "round",
  "floor",
  "ceil",
  "abs",
] as const

export const COMPUTE_FROM_OPS_ALL = [
  ...COMPUTE_FROM_OPS_WITH_OPERAND,
  ...COMPUTE_FROM_OPS_BARE,
] as const

export type ComputeFromBareOp =
  (typeof COMPUTE_FROM_OPS_BARE)[number]
export type ComputeFromVerbWithOperand =
  (typeof COMPUTE_FROM_OPS_WITH_OPERAND)[number]
export type ComputeFromOpWithOperand = {
  [K in ComputeFromVerbWithOperand]?: number
}
export type ComputeFromOp =
  | ComputeFromBareOp
  | ComputeFromOpWithOperand

export type ComputeFrom = {
  property: string
  scope: "scriptInfo" | "style"
  ops: ComputeFromOp[]
}

// ─── Decision 5: Fields map — keyed by arbitrary style field name ─────────────
// Decision 6: scaleResolution struct — keep nested (matches YAML shape) ────────

export type StyleFieldLiteral = string
export type StyleFieldComputed = {
  computeFrom: ComputeFrom
}
export type StyleFieldValue =
  | StyleFieldLiteral
  | StyleFieldComputed

export type StyleFieldsMap = Record<string, StyleFieldValue>

export type Resolution = { width: number; height: number }

// ─── Decision 2: Predicates map ───────────────────────────────────────────────
// Arbitrary name → key/value string map, stored as a sibling param.

export type PredicatesMap = Record<
  string,
  Record<string, string>
>

// ─── Rule discriminated union ─────────────────────────────────────────────────

export type SetScriptInfoRule = {
  type: "setScriptInfo"
  key: string
  value: string
  when?: WhenMap
}

export type ScaleResolutionRule = {
  type: "scaleResolution"
  from: Resolution
  to: Resolution
  hasScaledBorderAndShadow?: boolean
  when?: WhenMap
}

export type SetStyleFieldsRule = {
  type: "setStyleFields"
  fields: StyleFieldsMap
  ignoredStyleNamesRegexString?: string
  applyIf?: ApplyIfMap
  when?: WhenMap
}

export type DslRule =
  | SetScriptInfoRule
  | ScaleResolutionRule
  | SetStyleFieldsRule

// ─── Decision 7: openDetailsKeys — React useState per instance ────────────────
// Local UI state only; no reason to put in a Jotai atom.
// Shape: Set<string> where keys are `${stepId}:when:${ruleIndex}`,
// `${stepId}:applyif:${ruleIndex}`, or `${stepId}:predicates`.
export type OpenDetailsKeys = Set<string>

// ─── Decision 8: predicates and hasDefaultRules as sibling step.params ────────
// DslRulesBuilder manages THREE separate step.params keys independently:
//   step.params.rules          → DslRule[]
//   step.params.predicates     → PredicatesMap
//   step.params.hasDefaultRules → boolean
// Each committed via setParam(step.id, key, value | undefined).
// Setting undefined deletes the key (keeps YAML clean when empty).
export type DslBuilderParamKey =
  | "rules"
  | "predicates"
  | "hasDefaultRules"
