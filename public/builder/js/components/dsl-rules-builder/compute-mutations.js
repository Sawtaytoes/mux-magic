import { COMPUTE_FROM_OPS_BARE } from './constants.js'
import { isPlainObject } from './clause-utils.js'
import { getRules, commitRules, updateRuleAt } from './state.js'

export function setComputeFromField({ stepId, ruleIndex, fieldKey, propertyName, value }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: { computeFrom: { ...existing.computeFrom, [propertyName]: value } },
          },
        }
      },
    }),
  })
}

export function addComputeFromOp({ stepId, ruleIndex, fieldKey }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: { computeFrom: { ...existing.computeFrom, ops: [...ops, { add: 0 }] } },
          },
        }
      },
    }),
  })
}

export function setComputeFromOpVerb({ stepId, ruleIndex, fieldKey, opIndex, verb }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
        const nextOps = ops.map((op, index) => {
          if (index !== opIndex) { return op }
          if (COMPUTE_FROM_OPS_BARE.includes(verb)) { return verb }
          const previousOperand = isPlainObject(op) ? Object.values(op)[0] : 0
          const operand = typeof previousOperand === 'number' ? previousOperand : 0
          return { [verb]: operand }
        })
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: { computeFrom: { ...existing.computeFrom, ops: nextOps } },
          },
        }
      },
    }),
  })
}

export function setComputeFromOpOperand({ stepId, ruleIndex, fieldKey, opIndex, operand }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
        const nextOps = ops.map((op, index) => {
          if (index !== opIndex || !isPlainObject(op)) { return op }
          const verb = Object.keys(op)[0]
          return { [verb]: operand }
        })
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: { computeFrom: { ...existing.computeFrom, ops: nextOps } },
          },
        }
      },
    }),
  })
}

export function removeComputeFromOp({ stepId, ruleIndex, fieldKey, opIndex }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: {
              computeFrom: { ...existing.computeFrom, ops: ops.filter((_, index) => index !== opIndex) },
            },
          },
        }
      },
    }),
  })
}

export function moveComputeFromOp({ stepId, ruleIndex, fieldKey, opIndex, direction }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) { return rule }
        const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
        const targetIndex = opIndex + direction
        if (targetIndex < 0 || targetIndex >= ops.length) { return rule }
        const nextOps = ops.map((op) => op)
        const movingOp = nextOps[opIndex]
        nextOps[opIndex] = nextOps[targetIndex]
        nextOps[targetIndex] = movingOp
        return {
          ...rule,
          fields: {
            ...fields,
            [fieldKey]: { computeFrom: { ...existing.computeFrom, ops: nextOps } },
          },
        }
      },
    }),
  })
}
