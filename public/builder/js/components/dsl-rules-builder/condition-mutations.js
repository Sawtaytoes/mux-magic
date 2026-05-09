import { WHEN_CLAUSE_NAMES, APPLY_IF_CLAUSE_NAMES, COMPARATOR_VERBS } from './constants.js'
import { isPlainObject, isRefBody, normalizeWhenClause, compactWhenClause } from './clause-utils.js'
import { getRules, commitRules, updateRuleAt, generateFreshKey } from './state.js'

// ─── when: clause mutations ───────────────────────────────────────────────────

function setWhenSlot({ stepId, ruleIndex, mutator }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const when = isPlainObject(rule.when) ? rule.when : {}
        const nextWhen = mutator(when)
        const isWhenEmpty = !isPlainObject(nextWhen) || Object.keys(nextWhen).length === 0
        const nextRule = { ...rule }
        if (isWhenEmpty) {
          delete nextRule.when
        } else {
          nextRule.when = nextWhen
        }
        return nextRule
      },
    }),
  })
}

export function addWhenClause({ stepId, ruleIndex, clauseName }) {
  if (!WHEN_CLAUSE_NAMES.includes(clauseName)) { return }
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      if (Object.prototype.hasOwnProperty.call(when, clauseName)) { return when }
      return { ...when, [clauseName]: { matches: {}, excludes: null } }
    },
  })
}

export function removeWhenClause({ stepId, ruleIndex, clauseName }) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const nextWhen = { ...when }
      delete nextWhen[clauseName]
      return nextWhen
    },
  })
}

export function setWhenClauseRef({ stepId, ruleIndex, clauseName, slot, refName }) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const nextSlotValue = refName ? { $ref: refName } : {}
      const nextClause = { ...clause, [slot]: nextSlotValue }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function addWhenEntry({ stepId, ruleIndex, clauseName, slot }) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot]) ? clause[slot] : {}
      const finalKey = generateFreshKey({ baseName: 'key', usedNames: new Set(Object.keys(slotBody)) })
      const nextClause = { ...clause, [slot]: { ...slotBody, [finalKey]: '' } }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function setWhenEntryKey({ stepId, ruleIndex, clauseName, slot, oldKey, newKey }) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) { return }
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot]) ? clause[slot] : {}
      if (!Object.prototype.hasOwnProperty.call(slotBody, oldKey)) { return when }
      if (Object.prototype.hasOwnProperty.call(slotBody, trimmed)) { return when }
      const nextSlotBody = {}
      Object.entries(slotBody).forEach(([entryKey, entryValue]) => {
        if (entryKey === oldKey) {
          nextSlotBody[trimmed] = entryValue
        } else {
          nextSlotBody[entryKey] = entryValue
        }
      })
      const nextClause = { ...clause, [slot]: nextSlotBody }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function setWhenEntryValue({ stepId, ruleIndex, clauseName, slot, entryKey, value }) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot]) ? clause[slot] : {}
      const nextClause = { ...clause, [slot]: { ...slotBody, [entryKey]: value } }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function removeWhenEntry({ stepId, ruleIndex, clauseName, slot, entryKey }) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot]) ? clause[slot] : {}
      const nextSlotBody = { ...slotBody }
      delete nextSlotBody[entryKey]
      const nextClause = { ...clause, [slot]: nextSlotBody }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

// ─── applyIf clause mutations ─────────────────────────────────────────────────

function setApplyIfSlot({ stepId, ruleIndex, mutator }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const applyIf = isPlainObject(rule.applyIf) ? rule.applyIf : {}
        const nextApplyIf = mutator(applyIf)
        const isApplyIfEmpty = !isPlainObject(nextApplyIf) || Object.keys(nextApplyIf).length === 0
        const nextRule = { ...rule }
        if (isApplyIfEmpty) {
          delete nextRule.applyIf
        } else {
          nextRule.applyIf = nextApplyIf
        }
        return nextRule
      },
    }),
  })
}

export function addApplyIfClause({ stepId, ruleIndex, clauseName }) {
  if (!APPLY_IF_CLAUSE_NAMES.includes(clauseName)) { return }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      if (Object.prototype.hasOwnProperty.call(applyIf, clauseName)) { return applyIf }
      return { ...applyIf, [clauseName]: {} }
    },
  })
}

export function removeApplyIfClause({ stepId, ruleIndex, clauseName }) {
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const nextApplyIf = { ...applyIf }
      delete nextApplyIf[clauseName]
      return nextApplyIf
    },
  })
}

export function addApplyIfEntry({ stepId, ruleIndex, clauseName }) {
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const finalKey = generateFreshKey({ baseName: 'Field', usedNames: new Set(Object.keys(clause)) })
      return { ...applyIf, [clauseName]: { ...clause, [finalKey]: { eq: 0 } } }
    },
  })
}

export function setApplyIfEntryKey({ stepId, ruleIndex, clauseName, oldKey, newKey }) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) { return }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      if (!Object.prototype.hasOwnProperty.call(clause, oldKey)) { return applyIf }
      if (Object.prototype.hasOwnProperty.call(clause, trimmed)) { return applyIf }
      const nextClause = {}
      Object.entries(clause).forEach(([entryKey, entryValue]) => {
        if (entryKey === oldKey) {
          nextClause[trimmed] = entryValue
        } else {
          nextClause[entryKey] = entryValue
        }
      })
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}

export function setApplyIfEntryComparator({ stepId, ruleIndex, clauseName, entryKey, verb }) {
  if (!COMPARATOR_VERBS.includes(verb)) { return }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const existingEntry = clause[entryKey]
      const previousOperand = isPlainObject(existingEntry) ? Object.values(existingEntry)[0] : 0
      const operand = typeof previousOperand === 'number' ? previousOperand : 0
      return { ...applyIf, [clauseName]: { ...clause, [entryKey]: { [verb]: operand } } }
    },
  })
}

export function setApplyIfEntryOperand({ stepId, ruleIndex, clauseName, entryKey, operand }) {
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const existingEntry = clause[entryKey]
      if (!isPlainObject(existingEntry)) { return applyIf }
      const verb = Object.keys(existingEntry)[0]
      if (!verb) { return applyIf }
      return { ...applyIf, [clauseName]: { ...clause, [entryKey]: { [verb]: operand } } }
    },
  })
}

export function removeApplyIfEntry({ stepId, ruleIndex, clauseName, entryKey }) {
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const nextClause = { ...clause }
      delete nextClause[entryKey]
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}
