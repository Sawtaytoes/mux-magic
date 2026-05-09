import { isPlainObject } from './clause-utils.js'
import { getRules, commitRules, generateFreshKey, updateRuleAt } from './state.js'

export function addStyleField({ stepId, ruleIndex }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const finalKey = generateFreshKey({ baseName: 'Field', usedNames: new Set(Object.keys(fields)) })
        return { ...rule, fields: { ...fields, [finalKey]: '' } }
      },
    }),
  })
}

export function renameStyleField({ stepId, ruleIndex, oldKey, newKey }) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) { return }
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        if (!Object.prototype.hasOwnProperty.call(fields, oldKey)) { return rule }
        if (Object.prototype.hasOwnProperty.call(fields, trimmed)) { return rule }
        const nextFields = {}
        Object.entries(fields).forEach(([entryKey, entryValue]) => {
          if (entryKey === oldKey) {
            nextFields[trimmed] = entryValue
          } else {
            nextFields[entryKey] = entryValue
          }
        })
        return { ...rule, fields: nextFields }
      },
    }),
  })
}

export function setStyleFieldLiteralValue({ stepId, ruleIndex, fieldKey, value }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        return { ...rule, fields: { ...fields, [fieldKey]: value } }
      },
    }),
  })
}

export function setStyleFieldComputedToggle({ stepId, ruleIndex, fieldKey, isComputed }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const existing = fields[fieldKey]
        const nextValue = isComputed
          ? { computeFrom: { property: '', scope: 'scriptInfo', ops: [] } }
          : ''
        // Preserve the literal string when toggling off (best-effort — can't recover once flipped).
        const preserved = !isComputed && typeof existing === 'string' ? existing : nextValue
        return { ...rule, fields: { ...fields, [fieldKey]: preserved } }
      },
    }),
  })
}

export function removeStyleField({ stepId, ruleIndex, fieldKey }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const fields = isPlainObject(rule.fields) ? rule.fields : {}
        const nextFields = { ...fields }
        delete nextFields[fieldKey]
        return { ...rule, fields: nextFields }
      },
    }),
  })
}

export function setIgnoredStyleNamesRegex({ stepId, ruleIndex, value }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const trimmed = (value ?? '').trim()
        const nextRule = { ...rule }
        if (trimmed) {
          nextRule.ignoredStyleNamesRegexString = trimmed
        } else {
          delete nextRule.ignoredStyleNamesRegexString
        }
        return nextRule
      },
    }),
  })
}
