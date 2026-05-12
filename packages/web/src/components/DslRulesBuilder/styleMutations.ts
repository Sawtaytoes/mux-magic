import { isPlainObject } from "./clauseUtils"
import { generateFreshKey } from "./generateFreshKey"
import { updateRuleAt } from "./ruleMutations"
import type {
  ComputeFrom,
  DslRule,
  SetStyleFieldsRule,
  StyleFieldValue,
} from "./types"

const getFields = (
  rule: DslRule,
): Record<string, StyleFieldValue> => {
  const styleRule = rule as SetStyleFieldsRule
  return isPlainObject(styleRule.fields)
    ? (styleRule.fields as Record<string, StyleFieldValue>)
    : {}
}

export const addStyleField = ({
  rules,
  ruleIndex,
}: {
  rules: DslRule[]
  ruleIndex: number
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      const finalKey = generateFreshKey({
        baseName: "Field",
        usedNames: new Set(Object.keys(fields)),
      })
      return {
        ...rule,
        fields: { ...fields, [finalKey]: "" },
      }
    },
  })

export const renameStyleField = ({
  rules,
  ruleIndex,
  oldKey,
  newKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  oldKey: string
  newKey: string
}): DslRule[] => {
  const trimmed = (newKey ?? "").trim()
  if (!trimmed || trimmed === oldKey) {
    return rules
  }
  return updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      if (!Object.hasOwn(fields, oldKey)) {
        return rule
      }
      if (Object.hasOwn(fields, trimmed)) {
        return rule
      }
      const nextFields: Record<string, StyleFieldValue> = {}
      Object.entries(fields).forEach(
        ([entryKey, entryValue]) => {
          if (entryKey === oldKey) {
            nextFields[trimmed] = entryValue
          } else {
            nextFields[entryKey] = entryValue
          }
        },
      )
      return { ...rule, fields: nextFields }
    },
  })
}

export const setStyleFieldLiteralValue = ({
  rules,
  ruleIndex,
  fieldKey,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  value: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      return {
        ...rule,
        fields: { ...fields, [fieldKey]: value },
      }
    },
  })

export const setStyleFieldComputedToggle = ({
  rules,
  ruleIndex,
  fieldKey,
  isComputed,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  isComputed: boolean
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      const existing = fields[fieldKey]
      const nextValue: StyleFieldValue = isComputed
        ? {
            computeFrom: {
              property: "",
              scope: "scriptInfo",
              ops: [],
            },
          }
        : ""
      // Best-effort: preserve the literal string when toggling computed off.
      const preserved =
        !isComputed && typeof existing === "string"
          ? existing
          : nextValue
      return {
        ...rule,
        fields: { ...fields, [fieldKey]: preserved },
      }
    },
  })

export const removeStyleField = ({
  rules,
  ruleIndex,
  fieldKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      const nextFields = { ...fields }
      delete nextFields[fieldKey]
      return { ...rule, fields: nextFields }
    },
  })

// ─── computeFrom field-level setter ──────────────────────────────────────────

export const setComputeFromField = ({
  rules,
  ruleIndex,
  fieldKey,
  propertyName,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  propertyName: keyof ComputeFrom
  value: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const fields = getFields(rule)
      const existing = fields[fieldKey]
      if (
        !isPlainObject(existing) ||
        !isPlainObject(
          (existing as { computeFrom?: unknown })
            .computeFrom,
        )
      ) {
        return rule
      }
      const computeFrom = (
        existing as { computeFrom: ComputeFrom }
      ).computeFrom
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: {
              ...computeFrom,
              [propertyName]: value,
            },
          },
        },
      }
    },
  })
