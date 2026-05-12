import { isPlainObject } from "./clauseUtils"
import { generateFreshKey } from "./generateFreshKey"
import {
  type DslRule,
  type PredicatesMap,
  RULE_TYPES,
  type RuleType,
  type ScaleResolutionRule,
  type SetScriptInfoRule,
  type SetStyleFieldsRule,
} from "./types"

export const updateRuleAt = ({
  rules,
  ruleIndex,
  updater,
}: {
  rules: DslRule[]
  ruleIndex: number
  updater: (rule: DslRule) => DslRule
}): DslRule[] =>
  rules.map((rule, index) =>
    index === ruleIndex ? updater(rule) : rule,
  )

export const makeEmptyRule = (
  ruleType: RuleType,
): DslRule => {
  if (ruleType === "setScriptInfo") {
    return { type: "setScriptInfo", key: "", value: "" }
  }
  if (ruleType === "scaleResolution") {
    return {
      type: "scaleResolution",
      from: { width: 0, height: 0 },
      to: { width: 0, height: 0 },
    }
  }
  return { type: "setStyleFields", fields: {} }
}

// ─── Rules list mutations ─────────────────────────────────────────────────────

export const addRule = ({
  rules,
  ruleType,
  insertIndex,
}: {
  rules: DslRule[]
  ruleType?: RuleType
  insertIndex?: number
}): DslRule[] => {
  const newRule = makeEmptyRule(ruleType ?? "setScriptInfo")
  const target =
    typeof insertIndex === "number"
      ? insertIndex
      : rules.length
  return [
    ...rules.slice(0, target),
    newRule,
    ...rules.slice(target),
  ]
}

export const removeRule = ({
  rules,
  ruleIndex,
}: {
  rules: DslRule[]
  ruleIndex: number
}): DslRule[] =>
  rules.filter((_, index) => index !== ruleIndex)

export const moveRule = ({
  rules,
  ruleIndex,
  direction,
}: {
  rules: DslRule[]
  ruleIndex: number
  direction: -1 | 1
}): DslRule[] => {
  const targetIndex = ruleIndex + direction
  if (targetIndex < 0 || targetIndex >= rules.length) {
    return rules
  }
  const nextRules = rules.map((rule) => rule)
  const movingRule = nextRules[ruleIndex]
  nextRules[ruleIndex] = nextRules[targetIndex]
  nextRules[targetIndex] = movingRule
  return nextRules
}

export const changeRuleType = ({
  rules,
  ruleIndex,
  ruleType,
}: {
  rules: DslRule[]
  ruleIndex: number
  ruleType: RuleType
}): DslRule[] => {
  if (!RULE_TYPES.includes(ruleType)) {
    return rules
  }
  return updateRuleAt({
    rules,
    ruleIndex,
    updater: () => makeEmptyRule(ruleType),
  })
}

// ─── setScriptInfo mutations ──────────────────────────────────────────────────

export const setScriptInfoField = ({
  rules,
  ruleIndex,
  fieldName,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldName: keyof Pick<SetScriptInfoRule, "key" | "value">
  value: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => ({ ...rule, [fieldName]: value }),
  })

// ─── scaleResolution mutations ────────────────────────────────────────────────

export const setScaleResolutionDimension = ({
  rules,
  ruleIndex,
  group,
  dimension,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  group: "from" | "to"
  dimension: "width" | "height"
  value: number
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const scaleRule = rule as ScaleResolutionRule
      const groupValue = isPlainObject(scaleRule[group])
        ? scaleRule[group]
        : { width: 0, height: 0 }
      return {
        ...rule,
        [group]: { ...groupValue, [dimension]: value },
      }
    },
  })

export const setScaleResolutionFlag = ({
  rules,
  ruleIndex,
  flagName,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  flagName: "hasScaledBorderAndShadow"
  value: boolean
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => ({ ...rule, [flagName]: value }),
  })

// ─── hasDefaultRules toggle ───────────────────────────────────────────────────
// Returns the new value (undefined = delete the key).
export const nextHasDefaultRules = (
  isEnabled: boolean,
): true | undefined => (isEnabled ? true : undefined)

// ─── setStyleFields — ignoredStyleNamesRegexString ───────────────────────────

export const setIgnoredStyleNamesRegex = ({
  rules,
  ruleIndex,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  value: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const trimmed = (value ?? "").trim()
      const nextRule = { ...(rule as SetStyleFieldsRule) }
      if (trimmed) {
        nextRule.ignoredStyleNamesRegexString = trimmed
      } else {
        delete nextRule.ignoredStyleNamesRegexString
      }
      return nextRule
    },
  })

// ─── Predicate mutations ──────────────────────────────────────────────────────

export const addPredicate = ({
  predicates,
}: {
  predicates: PredicatesMap
}): PredicatesMap => {
  const freshName = generateFreshKey({
    baseName: "predicate",
    usedNames: new Set(Object.keys(predicates)),
  })
  return { ...predicates, [freshName]: {} }
}

export const renamePredicate = ({
  predicates,
  oldName,
  newName,
}: {
  predicates: PredicatesMap
  oldName: string
  newName: string
}): PredicatesMap => {
  const trimmed = (newName ?? "").trim()
  if (!trimmed || oldName === trimmed) {
    return predicates
  }
  if (!Object.hasOwn(predicates, oldName)) {
    return predicates
  }
  if (Object.hasOwn(predicates, trimmed)) {
    return predicates
  }
  const next: PredicatesMap = {}
  Object.entries(predicates).forEach(
    ([predicateName, predicateBody]) => {
      if (predicateName === oldName) {
        next[trimmed] = predicateBody
      } else {
        next[predicateName] = predicateBody
      }
    },
  )
  return next
}

export const removePredicate = ({
  predicates,
  predicateName,
}: {
  predicates: PredicatesMap
  predicateName: string
}): PredicatesMap => {
  const next = { ...predicates }
  delete next[predicateName]
  return next
}

export const addPredicateEntry = ({
  predicates,
  predicateName,
}: {
  predicates: PredicatesMap
  predicateName: string
}): PredicatesMap => {
  const body = isPlainObject(predicates[predicateName])
    ? (predicates[predicateName] as Record<string, string>)
    : {}
  const finalKey = generateFreshKey({
    baseName: "key",
    usedNames: new Set(Object.keys(body)),
  })
  return {
    ...predicates,
    [predicateName]: { ...body, [finalKey]: "" },
  }
}

export const setPredicateEntryKey = ({
  predicates,
  predicateName,
  oldKey,
  newKey,
}: {
  predicates: PredicatesMap
  predicateName: string
  oldKey: string
  newKey: string
}): PredicatesMap => {
  const trimmed = (newKey ?? "").trim()
  if (!trimmed || trimmed === oldKey) {
    return predicates
  }
  const body = isPlainObject(predicates[predicateName])
    ? (predicates[predicateName] as Record<string, string>)
    : {}
  if (!Object.hasOwn(body, oldKey)) {
    return predicates
  }
  if (Object.hasOwn(body, trimmed)) {
    return predicates
  }
  const nextBody: Record<string, string> = {}
  Object.entries(body).forEach(([entryKey, entryValue]) => {
    if (entryKey === oldKey) {
      nextBody[trimmed] = entryValue
    } else {
      nextBody[entryKey] = entryValue
    }
  })
  return { ...predicates, [predicateName]: nextBody }
}

export const setPredicateEntryValue = ({
  predicates,
  predicateName,
  entryKey,
  value,
}: {
  predicates: PredicatesMap
  predicateName: string
  entryKey: string
  value: string
}): PredicatesMap => {
  const body = isPlainObject(predicates[predicateName])
    ? (predicates[predicateName] as Record<string, string>)
    : {}
  return {
    ...predicates,
    [predicateName]: { ...body, [entryKey]: value },
  }
}

export const removePredicateEntry = ({
  predicates,
  predicateName,
  entryKey,
}: {
  predicates: PredicatesMap
  predicateName: string
  entryKey: string
}): PredicatesMap => {
  const body = isPlainObject(predicates[predicateName])
    ? (predicates[predicateName] as Record<string, string>)
    : {}
  const nextBody = { ...body }
  delete nextBody[entryKey]
  return { ...predicates, [predicateName]: nextBody }
}
