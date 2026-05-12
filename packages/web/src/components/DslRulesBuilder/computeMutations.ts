import { isPlainObject } from "./clauseUtils"
import { updateRuleAt } from "./ruleMutations"
import {
  COMPUTE_FROM_OPS_BARE,
  type ComputeFrom,
  type ComputeFromOp,
  type ComputeFromVerbWithOperand,
  type DslRule,
  type SetStyleFieldsRule,
  type StyleFieldValue,
} from "./types"

const getComputeFrom = (
  rule: DslRule,
  fieldKey: string,
): {
  fields: Record<string, StyleFieldValue>
  computeFrom: ComputeFrom
} | null => {
  const styleRule = rule as SetStyleFieldsRule
  const fields = isPlainObject(styleRule.fields)
    ? (styleRule.fields as Record<string, StyleFieldValue>)
    : {}
  const existing = fields[fieldKey]
  if (
    !isPlainObject(existing) ||
    !isPlainObject(
      (existing as { computeFrom?: unknown }).computeFrom,
    )
  ) {
    return null
  }
  return {
    fields,
    computeFrom: (existing as { computeFrom: ComputeFrom })
      .computeFrom,
  }
}

const replaceOps = (
  rule: DslRule,
  fieldKey: string,
  nextOps: ComputeFromOp[],
): DslRule => {
  const result = getComputeFrom(rule, fieldKey)
  if (!result) {
    return rule
  }
  const { fields, computeFrom } = result
  return {
    ...(rule as SetStyleFieldsRule),
    fields: {
      ...fields,
      [fieldKey]: {
        computeFrom: { ...computeFrom, ops: nextOps },
      },
    },
  }
}

export const addComputeFromOp = ({
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
      const result = getComputeFrom(rule, fieldKey)
      if (!result) {
        return rule
      }
      const ops = Array.isArray(result.computeFrom.ops)
        ? result.computeFrom.ops
        : []
      return replaceOps(rule, fieldKey, [
        ...ops,
        { add: 0 },
      ])
    },
  })

export const setComputeFromOpVerb = ({
  rules,
  ruleIndex,
  fieldKey,
  opIndex,
  verb,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  opIndex: number
  verb: string
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const result = getComputeFrom(rule, fieldKey)
      if (!result) {
        return rule
      }
      const ops = Array.isArray(result.computeFrom.ops)
        ? result.computeFrom.ops
        : []
      const nextOps = ops.map((op, index) => {
        if (index !== opIndex) {
          return op
        }
        if (
          COMPUTE_FROM_OPS_BARE.includes(
            verb as (typeof COMPUTE_FROM_OPS_BARE)[number],
          )
        ) {
          return verb as ComputeFromOp
        }
        const previousOperand = isPlainObject(op)
          ? Object.values(op)[0]
          : 0
        const operand =
          typeof previousOperand === "number"
            ? previousOperand
            : 0
        return {
          [verb as ComputeFromVerbWithOperand]: operand,
        } as ComputeFromOp
      })
      return replaceOps(rule, fieldKey, nextOps)
    },
  })

export const setComputeFromOpOperand = ({
  rules,
  ruleIndex,
  fieldKey,
  opIndex,
  operand,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  opIndex: number
  operand: number
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const result = getComputeFrom(rule, fieldKey)
      if (!result) {
        return rule
      }
      const ops = Array.isArray(result.computeFrom.ops)
        ? result.computeFrom.ops
        : []
      const nextOps = ops.map((op, index) => {
        if (index !== opIndex || !isPlainObject(op)) {
          return op
        }
        const verb = Object.keys(op)[0]
        return { [verb]: operand } as ComputeFromOp
      })
      return replaceOps(rule, fieldKey, nextOps)
    },
  })

export const removeComputeFromOp = ({
  rules,
  ruleIndex,
  fieldKey,
  opIndex,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  opIndex: number
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const result = getComputeFrom(rule, fieldKey)
      if (!result) {
        return rule
      }
      const ops = Array.isArray(result.computeFrom.ops)
        ? result.computeFrom.ops
        : []
      return replaceOps(
        rule,
        fieldKey,
        ops.filter((_, index) => index !== opIndex),
      )
    },
  })

export const moveComputeFromOp = ({
  rules,
  ruleIndex,
  fieldKey,
  opIndex,
  direction,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  opIndex: number
  direction: -1 | 1
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const result = getComputeFrom(rule, fieldKey)
      if (!result) {
        return rule
      }
      const ops = Array.isArray(result.computeFrom.ops)
        ? result.computeFrom.ops
        : []
      const targetIndex = opIndex + direction
      if (targetIndex < 0 || targetIndex >= ops.length) {
        return rule
      }
      const nextOps = ops.map((op) => op)
      const movingOp = nextOps[opIndex]
      nextOps[opIndex] = nextOps[targetIndex]
      nextOps[targetIndex] = movingOp
      return replaceOps(rule, fieldKey, nextOps)
    },
  })
