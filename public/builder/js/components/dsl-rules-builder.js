// ─── DSL rules builder ────────────────────────────────────────────────────────
//
// Structured form editor for the modifySubtitleMetadata DSL. Replaces the
// raw-JSON textarea with per-rule field controls for the three rule types
// (setScriptInfo / scaleResolution / setStyleFields) plus the supporting
// `when:` predicate builder, `applyIf` per-style comparator builder,
// `computeFrom` math-ops editor, top-level `predicates:` map manager, and
// the `hasDefaultRules` toggle that surfaces the read-only default rules.
//
// Source of truth for every shape rendered here: docs/dsl/subtitle-rules.md.
// Keep this file in sync with that doc when the DSL grows.
//
// Storage model: the parent step's params hold two top-level keys —
// `rules` (array of rule objects, exactly the shape the API consumes) and
// `predicates` (named-predicate map). Both round-trip through YAML/load
// unchanged from the legacy JSON-textarea representation, so loading an
// older sequence still hydrates this builder, and saving produces YAML
// the validator already understands.

import { esc } from '../step-renderer.js'

const bridge = () => window.mediaTools

// ─── Field metadata ───────────────────────────────────────────────────────────

export const RULE_TYPES = ['setScriptInfo', 'scaleResolution', 'setStyleFields']

export const WHEN_CLAUSE_NAMES = [
  'anyScriptInfo',
  'allScriptInfo',
  'noneScriptInfo',
  'notAllScriptInfo',
  'anyStyle',
  'allStyle',
  'noneStyle',
]

export const APPLY_IF_CLAUSE_NAMES = [
  'anyStyleMatches',
  'allStyleMatches',
  'noneStyleMatches',
]

export const COMPARATOR_VERBS = ['eq', 'lt', 'gt', 'lte', 'gte']

export const COMPUTE_FROM_OPS_WITH_OPERAND = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'min',
  'max',
]

export const COMPUTE_FROM_OPS_BARE = ['round', 'floor', 'ceil', 'abs']

export const COMPUTE_FROM_OPS_ALL = [
  ...COMPUTE_FROM_OPS_WITH_OPERAND,
  ...COMPUTE_FROM_OPS_BARE,
]

// Default rules displayed when `hasDefaultRules: true`. Hardcoded from
// the table in docs/dsl/subtitle-rules.md §What "default rules" means.
// Update this list whenever buildDefaultSubtitleModificationRules.ts
// changes shape. The UI renders these read-only above the user rules.
export const DEFAULT_RULES_PREVIEW = [
  {
    type: 'setScriptInfo',
    key: 'ScriptType',
    value: 'v4.00+',
  },
  {
    type: 'setScriptInfo',
    key: 'YCbCr Matrix',
    value: 'TV.709',
    when: {
      anyScriptInfo: {
        matches: { 'YCbCr Matrix': 'TV.601' },
        excludes: {
          'YCbCr Matrix': 'TV.601',
          PlayResX: '640',
          PlayResY: '480',
        },
      },
    },
  },
  {
    type: 'setStyleFields',
    fields: {
      MarginV: {
        computeFrom: {
          property: 'PlayResY',
          scope: 'scriptInfo',
          ops: [
            { divide: 1080 },
            { multiply: 90 },
            'round',
          ],
        },
      },
    },
    ignoredStyleNamesRegexString: 'signs?|op|ed|opening|ending',
  },
  {
    type: 'setStyleFields',
    fields: {
      MarginL: {
        computeFrom: {
          property: 'PlayResX',
          scope: 'scriptInfo',
          ops: [
            { divide: 1920 },
            { multiply: 200 },
            'round',
          ],
        },
      },
      MarginR: {
        computeFrom: {
          property: 'PlayResX',
          scope: 'scriptInfo',
          ops: [
            { divide: 1920 },
            { multiply: 200 },
            'round',
          ],
        },
      },
    },
    ignoredStyleNamesRegexString: 'signs?|op|ed|opening|ending',
    applyIf: {
      anyStyleMatches: {
        MarginL: { lt: 50 },
      },
    },
  },
]

// ─── Data normalization ───────────────────────────────────────────────────────
//
// The DSL allows shorthand forms (bare key→value map = `matches:` only).
// On read we keep that flexibility, but the editor only manipulates the
// canonical (matches/excludes) form so we don't have to render two
// different sub-UIs for the same data. `normalizeWhenClause` converts
// shorthand into canonical so the editor logic doesn't fork. On write,
// `compactWhenClause` collapses back to shorthand when only `matches:`
// is set with literal entries — keeps the YAML clean.

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeWhenClause(clause) {
  if (!isPlainObject(clause)) {
    return { matches: {}, excludes: null }
  }
  const hasMatchesKey = Object.prototype.hasOwnProperty.call(clause, 'matches')
  const hasExcludesKey = Object.prototype.hasOwnProperty.call(clause, 'excludes')
  if (hasMatchesKey || hasExcludesKey) {
    return {
      matches: hasMatchesKey ? clause.matches : null,
      excludes: hasExcludesKey ? clause.excludes : null,
    }
  }
  return { matches: { ...clause }, excludes: null }
}

export function compactWhenClause(canonicalClause) {
  const matches = canonicalClause.matches
  const excludes = canonicalClause.excludes
  const hasMatches = isPlainObject(matches) && Object.keys(matches).length > 0 || isRefBody(matches)
  const hasExcludes = isPlainObject(excludes) && Object.keys(excludes).length > 0 || isRefBody(excludes)
  if (!hasMatches && !hasExcludes) {
    return null
  }
  if (hasMatches && !hasExcludes && !isRefBody(matches)) {
    return { ...matches }
  }
  const result = {}
  if (hasMatches) {
    result.matches = isRefBody(matches) ? { $ref: matches.$ref } : { ...matches }
  }
  if (hasExcludes) {
    result.excludes = isRefBody(excludes) ? { $ref: excludes.$ref } : { ...excludes }
  }
  return result
}

export function isRefBody(body) {
  return isPlainObject(body) && typeof body.$ref === 'string'
}

// ─── Step state accessors ─────────────────────────────────────────────────────

function findStepOrNull(stepId) {
  return bridge().findStepById?.(stepId) ?? null
}

function getRules(stepId) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return []
  }
  const rules = step.params.rules
  return Array.isArray(rules) ? rules : []
}

function getPredicates(stepId) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return {}
  }
  const predicates = step.params.predicates
  return isPlainObject(predicates) ? predicates : {}
}

function commitRules({ stepId, nextRules }) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return
  }
  if (Array.isArray(nextRules) && nextRules.length > 0) {
    step.params.rules = nextRules
  } else {
    delete step.params.rules
  }
  bridge().renderAll?.()
}

function commitPredicates({ stepId, nextPredicates }) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return
  }
  if (isPlainObject(nextPredicates) && Object.keys(nextPredicates).length > 0) {
    step.params.predicates = nextPredicates
  } else {
    delete step.params.predicates
  }
  bridge().renderAll?.()
}

// ─── Mutation primitives ──────────────────────────────────────────────────────
//
// Every mutation goes through one of these helpers so the input model
// stays "render → mutate → re-render" rather than "diff DOM events".
// Each helper builds a fresh array/object via `.map`/`.filter`/spread —
// no in-place mutation of the rule objects themselves.

// Pick the first `<baseName>`, `<baseName>2`, `<baseName>3`, … that is
// not already in `usedNames`. Used wherever the editor adds a new entry
// row and needs a placeholder key the user can rename. The form only
// commits the rename if the new key doesn't already collide, so a
// duplicate name here is recoverable, but starting fresh is friendlier.
function generateFreshKey({ baseName, usedNames }) {
  const buildCandidate = (suffixIndex) => (
    suffixIndex === 0
    ? baseName
    : `${baseName}${suffixIndex + 1}`
  )
  // Bounded search space — 64 entries is far more than any UI flow will
  // ever produce, but keeping the array literal makes the lookup
  // functional (no `for` loop) per AGENTS.md.
  const indexes = Array.from({ length: 64 }, (_, position) => position)
  const found = indexes.find((suffixIndex) => !usedNames.has(buildCandidate(suffixIndex)))
  // Fallback if every candidate in the bounded range is taken — append
  // the size to guarantee uniqueness.
  if (found === undefined) {
    return `${baseName}${usedNames.size + 1}`
  }
  return buildCandidate(found)
}

export function makeEmptyRule(ruleType) {
  if (ruleType === 'setScriptInfo') {
    return { type: 'setScriptInfo', key: '', value: '' }
  }
  if (ruleType === 'scaleResolution') {
    return {
      type: 'scaleResolution',
      from: { width: 0, height: 0 },
      to: { width: 0, height: 0 },
    }
  }
  if (ruleType === 'setStyleFields') {
    return { type: 'setStyleFields', fields: {} }
  }
  return { type: ruleType }
}

function updateRuleAt({ rules, ruleIndex, updater }) {
  return rules.map((rule, index) => (
    index === ruleIndex
    ? updater(rule)
    : rule
  ))
}

// ─── Top-level: predicates manager ────────────────────────────────────────────

export function addPredicate({ stepId }) {
  const current = getPredicates(stepId)
  const freshName = generateFreshKey({
    baseName: 'predicate',
    usedNames: new Set(Object.keys(current)),
  })
  const next = { ...current, [freshName]: {} }
  commitPredicates({ stepId, nextPredicates: next })
}

export function renamePredicate({ stepId, oldName, newName }) {
  const trimmedNewName = (newName ?? '').trim()
  if (!trimmedNewName || oldName === trimmedNewName) {
    return
  }
  const current = getPredicates(stepId)
  if (!Object.prototype.hasOwnProperty.call(current, oldName)) {
    return
  }
  if (Object.prototype.hasOwnProperty.call(current, trimmedNewName)) {
    return
  }
  const next = {}
  Object.entries(current).forEach(([predicateName, predicateBody]) => {
    if (predicateName === oldName) {
      next[trimmedNewName] = predicateBody
    } else {
      next[predicateName] = predicateBody
    }
  })
  commitPredicates({ stepId, nextPredicates: next })
}

export function removePredicate({ stepId, predicateName }) {
  const current = getPredicates(stepId)
  const next = { ...current }
  delete next[predicateName]
  commitPredicates({ stepId, nextPredicates: next })
}

export function addPredicateEntry({ stepId, predicateName }) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName]) ? current[predicateName] : {}
  const finalKey = generateFreshKey({
    baseName: 'key',
    usedNames: new Set(Object.keys(body)),
  })
  const next = {
    ...current,
    [predicateName]: { ...body, [finalKey]: '' },
  }
  commitPredicates({ stepId, nextPredicates: next })
}

export function setPredicateEntryKey({ stepId, predicateName, oldKey, newKey }) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) {
    return
  }
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName]) ? current[predicateName] : {}
  if (!Object.prototype.hasOwnProperty.call(body, oldKey)) {
    return
  }
  if (Object.prototype.hasOwnProperty.call(body, trimmed)) {
    return
  }
  const nextBody = {}
  Object.entries(body).forEach(([entryKey, entryValue]) => {
    if (entryKey === oldKey) {
      nextBody[trimmed] = entryValue
    } else {
      nextBody[entryKey] = entryValue
    }
  })
  commitPredicates({ stepId, nextPredicates: { ...current, [predicateName]: nextBody } })
}

export function setPredicateEntryValue({ stepId, predicateName, entryKey, value }) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName]) ? current[predicateName] : {}
  const nextBody = { ...body, [entryKey]: value }
  commitPredicates({ stepId, nextPredicates: { ...current, [predicateName]: nextBody } })
}

export function removePredicateEntry({ stepId, predicateName, entryKey }) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName]) ? current[predicateName] : {}
  const nextBody = { ...body }
  delete nextBody[entryKey]
  commitPredicates({ stepId, nextPredicates: { ...current, [predicateName]: nextBody } })
}

// ─── Rules list mutations ─────────────────────────────────────────────────────

export function addRule({ stepId, ruleType, insertIndex }) {
  const current = getRules(stepId)
  const newRule = makeEmptyRule(ruleType ?? 'setScriptInfo')
  const target = typeof insertIndex === 'number' ? insertIndex : current.length
  const next = [...current.slice(0, target), newRule, ...current.slice(target)]
  commitRules({ stepId, nextRules: next })
}

export function removeRule({ stepId, ruleIndex }) {
  const current = getRules(stepId)
  const next = current.filter((_, index) => index !== ruleIndex)
  commitRules({ stepId, nextRules: next })
}

export function moveRule({ stepId, ruleIndex, direction }) {
  const current = getRules(stepId)
  const targetIndex = ruleIndex + direction
  if (targetIndex < 0 || targetIndex >= current.length) {
    return
  }
  const next = current.map((rule) => rule)
  const movingRule = next[ruleIndex]
  next[ruleIndex] = next[targetIndex]
  next[targetIndex] = movingRule
  commitRules({ stepId, nextRules: next })
}

export function changeRuleType({ stepId, ruleIndex, ruleType }) {
  const current = getRules(stepId)
  if (!RULE_TYPES.includes(ruleType)) {
    return
  }
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: () => makeEmptyRule(ruleType),
  })
  commitRules({ stepId, nextRules: next })
}

// ─── setScriptInfo mutations ──────────────────────────────────────────────────

export function setScriptInfoField({ stepId, ruleIndex, fieldName, value }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => ({ ...rule, [fieldName]: value }),
  })
  commitRules({ stepId, nextRules: next })
}

// ─── scaleResolution mutations ────────────────────────────────────────────────

export function setScaleResolutionDimension({
  stepId, ruleIndex, group, dimension, value,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const groupValue = isPlainObject(rule[group]) ? rule[group] : { width: 0, height: 0 }
      return {
        ...rule,
        [group]: { ...groupValue, [dimension]: value },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function setScaleResolutionFlag({ stepId, ruleIndex, flagName, value }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => ({ ...rule, [flagName]: value }),
  })
  commitRules({ stepId, nextRules: next })
}

// ─── setStyleFields mutations ─────────────────────────────────────────────────

export function addStyleField({ stepId, ruleIndex }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const finalKey = generateFreshKey({
        baseName: 'Field',
        usedNames: new Set(Object.keys(fields)),
      })
      return { ...rule, fields: { ...fields, [finalKey]: '' } }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function renameStyleField({ stepId, ruleIndex, oldKey, newKey }) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) {
    return
  }
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      if (!Object.prototype.hasOwnProperty.call(fields, oldKey)) {
        return rule
      }
      if (Object.prototype.hasOwnProperty.call(fields, trimmed)) {
        return rule
      }
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
  })
  commitRules({ stepId, nextRules: next })
}

export function setStyleFieldLiteralValue({
  stepId, ruleIndex, fieldKey, value,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      return { ...rule, fields: { ...fields, [fieldKey]: value } }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function setStyleFieldComputedToggle({
  stepId, ruleIndex, fieldKey, isComputed,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      const nextValue = isComputed
        ? {
          computeFrom: {
            property: '',
            scope: 'scriptInfo',
            ops: [],
          },
        }
        : ''
      // Preserve the literal string when toggling off if it survived in
      // the existing computed shape (we can't recover it once the user
      // flipped away from literal mode, so this is best-effort).
      const preserved = !isComputed && typeof existing === 'string' ? existing : nextValue
      return { ...rule, fields: { ...fields, [fieldKey]: preserved } }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function removeStyleField({ stepId, ruleIndex, fieldKey }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const nextFields = { ...fields }
      delete nextFields[fieldKey]
      return { ...rule, fields: nextFields }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function setIgnoredStyleNamesRegex({ stepId, ruleIndex, value }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
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
  })
  commitRules({ stepId, nextRules: next })
}

// ─── computeFrom editor mutations ─────────────────────────────────────────────

export function setComputeFromField({
  stepId, ruleIndex, fieldKey, propertyName, value,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, [propertyName]: value },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function addComputeFromOp({
  stepId, ruleIndex, fieldKey,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, ops: [...ops, { add: 0 }] },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function setComputeFromOpVerb({
  stepId, ruleIndex, fieldKey, opIndex, verb,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
      const nextOps = ops.map((op, index) => {
        if (index !== opIndex) {
          return op
        }
        if (COMPUTE_FROM_OPS_BARE.includes(verb)) {
          return verb
        }
        const previousOperand = isPlainObject(op)
          ? Object.values(op)[0]
          : 0
        const operand = typeof previousOperand === 'number' ? previousOperand : 0
        return { [verb]: operand }
      })
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, ops: nextOps },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function setComputeFromOpOperand({
  stepId, ruleIndex, fieldKey, opIndex, operand,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
      const nextOps = ops.map((op, index) => {
        if (index !== opIndex) {
          return op
        }
        if (!isPlainObject(op)) {
          return op
        }
        const verb = Object.keys(op)[0]
        return { [verb]: operand }
      })
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, ops: nextOps },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function removeComputeFromOp({
  stepId, ruleIndex, fieldKey, opIndex,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
      const nextOps = ops.filter((_, index) => index !== opIndex)
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, ops: nextOps },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

export function moveComputeFromOp({
  stepId, ruleIndex, fieldKey, opIndex, direction,
}) {
  const current = getRules(stepId)
  const next = updateRuleAt({
    rules: current,
    ruleIndex,
    updater: (rule) => {
      const fields = isPlainObject(rule.fields) ? rule.fields : {}
      const existing = fields[fieldKey]
      if (!isPlainObject(existing) || !isPlainObject(existing.computeFrom)) {
        return rule
      }
      const ops = Array.isArray(existing.computeFrom.ops) ? existing.computeFrom.ops : []
      const targetIndex = opIndex + direction
      if (targetIndex < 0 || targetIndex >= ops.length) {
        return rule
      }
      const nextOps = ops.map((op) => op)
      const movingOp = nextOps[opIndex]
      nextOps[opIndex] = nextOps[targetIndex]
      nextOps[targetIndex] = movingOp
      return {
        ...rule,
        fields: {
          ...fields,
          [fieldKey]: {
            computeFrom: { ...existing.computeFrom, ops: nextOps },
          },
        },
      }
    },
  })
  commitRules({ stepId, nextRules: next })
}

// ─── when: clause mutations ───────────────────────────────────────────────────

function setWhenSlot({ stepId, ruleIndex, mutator }) {
  const current = getRules(stepId)
  const next = updateRuleAt({
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
  })
  commitRules({ stepId, nextRules: next })
}

export function addWhenClause({ stepId, ruleIndex, clauseName }) {
  if (!WHEN_CLAUSE_NAMES.includes(clauseName)) {
    return
  }
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      if (Object.prototype.hasOwnProperty.call(when, clauseName)) {
        return when
      }
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

export function setWhenClauseRef({
  stepId, ruleIndex, clauseName, slot, refName,
}) {
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

export function addWhenEntry({
  stepId, ruleIndex, clauseName, slot,
}) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot])
        ? clause[slot]
        : {}
      const finalKey = generateFreshKey({ baseName: 'key', usedNames: new Set(Object.keys(slotBody)) })
      const nextClause = { ...clause, [slot]: { ...slotBody, [finalKey]: '' } }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function setWhenEntryKey({
  stepId, ruleIndex, clauseName, slot, oldKey, newKey,
}) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) {
    return
  }
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot])
        ? clause[slot]
        : {}
      if (!Object.prototype.hasOwnProperty.call(slotBody, oldKey)) {
        return when
      }
      if (Object.prototype.hasOwnProperty.call(slotBody, trimmed)) {
        return when
      }
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

export function setWhenEntryValue({
  stepId, ruleIndex, clauseName, slot, entryKey, value,
}) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot])
        ? clause[slot]
        : {}
      const nextSlotBody = { ...slotBody, [entryKey]: value }
      const nextClause = { ...clause, [slot]: nextSlotBody }
      return { ...when, [clauseName]: compactWhenClause(nextClause) ?? { matches: {}, excludes: null } }
    },
  })
}

export function removeWhenEntry({
  stepId, ruleIndex, clauseName, slot, entryKey,
}) {
  setWhenSlot({
    stepId,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody = isPlainObject(clause[slot]) && !isRefBody(clause[slot])
        ? clause[slot]
        : {}
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
  const next = updateRuleAt({
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
  })
  commitRules({ stepId, nextRules: next })
}

export function addApplyIfClause({ stepId, ruleIndex, clauseName }) {
  if (!APPLY_IF_CLAUSE_NAMES.includes(clauseName)) {
    return
  }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      if (Object.prototype.hasOwnProperty.call(applyIf, clauseName)) {
        return applyIf
      }
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
      const finalKey = generateFreshKey({
        baseName: 'Field',
        usedNames: new Set(Object.keys(clause)),
      })
      const nextClause = { ...clause, [finalKey]: { eq: 0 } }
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}

export function setApplyIfEntryKey({
  stepId, ruleIndex, clauseName, oldKey, newKey,
}) {
  const trimmed = (newKey ?? '').trim()
  if (!trimmed || trimmed === oldKey) {
    return
  }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      if (!Object.prototype.hasOwnProperty.call(clause, oldKey)) {
        return applyIf
      }
      if (Object.prototype.hasOwnProperty.call(clause, trimmed)) {
        return applyIf
      }
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

export function setApplyIfEntryComparator({
  stepId, ruleIndex, clauseName, entryKey, verb,
}) {
  if (!COMPARATOR_VERBS.includes(verb)) {
    return
  }
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const existingEntry = clause[entryKey]
      const previousOperand = isPlainObject(existingEntry)
        ? Object.values(existingEntry)[0]
        : 0
      const operand = typeof previousOperand === 'number' ? previousOperand : 0
      const nextClause = { ...clause, [entryKey]: { [verb]: operand } }
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}

export function setApplyIfEntryOperand({
  stepId, ruleIndex, clauseName, entryKey, operand,
}) {
  setApplyIfSlot({
    stepId,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName]) ? applyIf[clauseName] : {}
      const existingEntry = clause[entryKey]
      if (!isPlainObject(existingEntry)) {
        return applyIf
      }
      const verb = Object.keys(existingEntry)[0]
      if (!verb) {
        return applyIf
      }
      const nextClause = { ...clause, [entryKey]: { [verb]: operand } }
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}

export function removeApplyIfEntry({
  stepId, ruleIndex, clauseName, entryKey,
}) {
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

// ─── hasDefaultRules toggle ───────────────────────────────────────────────────

export function setHasDefaultRules({ stepId, isEnabled }) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return
  }
  if (isEnabled) {
    step.params.hasDefaultRules = true
  } else {
    delete step.params.hasDefaultRules
  }
  bridge().renderAll?.()
}

// ─── Rendering ────────────────────────────────────────────────────────────────
//
// The renderer takes the step+stepIndex, reads its params.rules and
// params.predicates, and emits the full HTML for the field. Every
// interactive control wires onto a `dslRules.<action>(…)` window-global
// which calls back into the mutation helpers above.

function renderPredicateOptions({ predicates, selectedRefName }) {
  const blank = `<option value=""${selectedRefName ? '' : ' selected'}>— inline —</option>`
  const options = Object.keys(predicates).map((predicateName) => (
    `<option value="${esc(predicateName)}"${selectedRefName === predicateName ? ' selected' : ''}>$ref: ${esc(predicateName)}</option>`
  )).join('')
  return blank + options
}

function renderKeyValueRow({
  stepId, ruleIndex, clauseName, slot, entryKey, entryValue, isReadOnly,
}) {
  const readOnlyAttribute = isReadOnly ? 'readonly' : ''
  const removeButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeWhenEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',entryKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const onKeyChange = isReadOnly
    ? ''
    : `onchange="dslRules.setWhenEntryKey({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',oldKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')},newKey:this.value})"`
  const onValueInput = isReadOnly
    ? ''
    : `oninput="dslRules.setWhenEntryValue({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',entryKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')},value:this.value})"`
  return `<div class="flex items-center gap-1.5 mt-1">
    <input type="text" value="${esc(entryKey)}" placeholder="key" ${readOnlyAttribute} ${onKeyChange}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    <span class="text-slate-500 text-xs">=</span>
    <input type="text" value="${esc(entryValue)}" placeholder="value" ${readOnlyAttribute} ${onValueInput}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    ${removeButton}
  </div>`
}

function renderWhenSlot({
  stepId, ruleIndex, clauseName, slot, slotValue, predicates, isReadOnly,
}) {
  const isRef = isRefBody(slotValue)
  const refName = isRef ? slotValue.$ref : ''
  const slotLabel = slot === 'matches' ? 'Matches' : 'Excludes'
  const refDropdown = `<select ${isReadOnly ? 'disabled' : ''}
    onchange="dslRules.setWhenClauseRef({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',refName:this.value})"
    class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500">
    ${renderPredicateOptions({ predicates, selectedRefName: refName })}
  </select>`
  const slotBody = (isPlainObject(slotValue) && !isRef) ? slotValue : {}
  const entries = Object.entries(slotBody)
  const entryRows = entries.map(([entryKey, entryValue]) => (
    renderKeyValueRow({
      stepId, ruleIndex, clauseName, slot, entryKey, entryValue, isReadOnly,
    })
  )).join('')
  const addButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.addWhenEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}'})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>`
  return `<div class="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40">
    <div class="flex items-center gap-2">
      <span class="text-xs uppercase tracking-wide text-slate-400">${slotLabel}</span>
      ${refDropdown}
    </div>
    ${isRef ? '' : entryRows}
    ${isRef ? '' : addButton}
  </div>`
}

function renderWhenClause({
  stepId, ruleIndex, clauseName, clauseValue, predicates, isReadOnly,
}) {
  const canonical = normalizeWhenClause(clauseValue)
  const removeClauseButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeWhenClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-500 hover:text-red-400">✕ Remove clause</button>`
  return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-mono text-blue-300">${esc(clauseName)}</span>
      ${removeClauseButton}
    </div>
    ${renderWhenSlot({
      stepId, ruleIndex, clauseName, slot: 'matches', slotValue: canonical.matches, predicates, isReadOnly,
    })}
    <div class="mt-1.5">
      ${renderWhenSlot({
        stepId, ruleIndex, clauseName, slot: 'excludes', slotValue: canonical.excludes, predicates, isReadOnly,
      })}
    </div>
  </div>`
}

function renderWhenBuilder({
  stepId, ruleIndex, whenValue, predicates, isReadOnly,
}) {
  const when = isPlainObject(whenValue) ? whenValue : {}
  const usedClauses = new Set(Object.keys(when))
  const availableClauses = WHEN_CLAUSE_NAMES.filter((clauseName) => !usedClauses.has(clauseName))
  const clauseRows = WHEN_CLAUSE_NAMES
    .filter((clauseName) => usedClauses.has(clauseName))
    .map((clauseName) => renderWhenClause({
      stepId, ruleIndex, clauseName, clauseValue: when[clauseName], predicates, isReadOnly,
    }))
    .join('')
  const addClauseDropdown = isReadOnly || availableClauses.length === 0
    ? ''
    : `<select ${availableClauses.length === 0 ? 'disabled' : ''}
        onchange="dslRules.addWhenClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:this.value}); this.value=''"
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-2">
        <option value="">+ Add clause…</option>
        ${availableClauses.map((clauseName) => `<option value="${clauseName}">${clauseName}</option>`).join('')}
      </select>`
  return `<details class="mt-2 border border-slate-700/60 rounded">
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">When (advanced — leave empty to always fire)</summary>
    <div class="px-2 py-1.5">
      ${clauseRows || '<p class="text-xs text-slate-500 italic">No clauses. Rule fires on every batch.</p>'}
      ${addClauseDropdown}
    </div>
  </details>`
}

function renderApplyIfEntryRow({
  stepId, ruleIndex, clauseName, entryKey, entryValue, isReadOnly,
}) {
  const readOnlyAttribute = isReadOnly ? 'readonly' : ''
  const verb = isPlainObject(entryValue) ? Object.keys(entryValue)[0] : 'eq'
  const operand = isPlainObject(entryValue) ? entryValue[verb] : 0
  const removeButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeApplyIfEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const onKeyChange = isReadOnly
    ? ''
    : `onchange="dslRules.setApplyIfEntryKey({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',oldKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')},newKey:this.value})"`
  const onVerbChange = isReadOnly
    ? ''
    : `onchange="dslRules.setApplyIfEntryComparator({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')},verb:this.value})"`
  const onOperandInput = isReadOnly
    ? ''
    : `oninput="dslRules.setApplyIfEntryOperand({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, '&quot;')},operand:this.value===''?0:Number(this.value)})"`
  return `<div class="flex items-center gap-1.5 mt-1">
    <input type="text" value="${esc(entryKey)}" placeholder="Field" ${readOnlyAttribute} ${onKeyChange}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    <select ${readOnlyAttribute ? 'disabled' : ''} ${onVerbChange}
      class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
      ${COMPARATOR_VERBS.map((comparatorVerb) => `<option value="${comparatorVerb}"${comparatorVerb === verb ? ' selected' : ''}>${comparatorVerb}</option>`).join('')}
    </select>
    <input type="number" value="${esc(operand)}" ${readOnlyAttribute} ${onOperandInput}
      class="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    ${removeButton}
  </div>`
}

function renderApplyIfClause({
  stepId, ruleIndex, clauseName, clauseValue, isReadOnly,
}) {
  const clause = isPlainObject(clauseValue) ? clauseValue : {}
  const entries = Object.entries(clause)
  const entryRows = entries.map(([entryKey, entryValue]) => (
    renderApplyIfEntryRow({
      stepId, ruleIndex, clauseName, entryKey, entryValue, isReadOnly,
    })
  )).join('')
  const removeClauseButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeApplyIfClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-500 hover:text-red-400">✕ Remove clause</button>`
  const addEntryButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.addApplyIfEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>`
  return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-mono text-blue-300">${esc(clauseName)}</span>
      ${removeClauseButton}
    </div>
    ${entryRows}
    ${addEntryButton}
  </div>`
}

function renderApplyIfBuilder({ stepId, ruleIndex, applyIfValue, isReadOnly }) {
  const applyIf = isPlainObject(applyIfValue) ? applyIfValue : {}
  const usedClauses = new Set(Object.keys(applyIf))
  const availableClauses = APPLY_IF_CLAUSE_NAMES.filter((clauseName) => !usedClauses.has(clauseName))
  const clauseRows = APPLY_IF_CLAUSE_NAMES
    .filter((clauseName) => usedClauses.has(clauseName))
    .map((clauseName) => renderApplyIfClause({
      stepId, ruleIndex, clauseName, clauseValue: applyIf[clauseName], isReadOnly,
    }))
    .join('')
  const addClauseDropdown = isReadOnly || availableClauses.length === 0
    ? ''
    : `<select onchange="dslRules.addApplyIfClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:this.value}); this.value=''"
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-2">
        <option value="">+ Add clause…</option>
        ${availableClauses.map((clauseName) => `<option value="${clauseName}">${clauseName}</option>`).join('')}
      </select>`
  return `<details class="mt-2 border border-slate-700/60 rounded">
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">applyIf (per-style filter — leave empty to apply to all non-ignored styles)</summary>
    <div class="px-2 py-1.5">
      ${clauseRows || '<p class="text-xs text-slate-500 italic">No clauses. Applies to all non-ignored styles.</p>'}
      ${addClauseDropdown}
    </div>
  </details>`
}

function renderComputeFromOpRow({
  stepId, ruleIndex, fieldKey, opIndex, op, isReadOnly, isFirst, isLast,
}) {
  const verb = isPlainObject(op) ? Object.keys(op)[0] : op
  const operand = isPlainObject(op) ? Object.values(op)[0] : null
  const isBareOp = COMPUTE_FROM_OPS_BARE.includes(verb)
  const fieldKeyJson = JSON.stringify(fieldKey).replace(/"/g, '&quot;')
  const verbDropdown = `<select ${isReadOnly ? 'disabled' : ''}
    onchange="dslRules.setComputeFromOpVerb({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},verb:this.value})"
    class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
    ${COMPUTE_FROM_OPS_ALL.map((opVerb) => `<option value="${opVerb}"${opVerb === verb ? ' selected' : ''}>${opVerb}</option>`).join('')}
  </select>`
  const operandInput = isBareOp
    ? '<span class="text-xs text-slate-500 italic px-2">no operand</span>'
    : `<input type="number" value="${esc(operand ?? 0)}" ${isReadOnly ? 'readonly' : ''}
        oninput="dslRules.setComputeFromOpOperand({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},operand:this.value===''?0:Number(this.value)})"
        class="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />`
  const moveButtons = isReadOnly
    ? ''
    : `<button type="button" ${isFirst ? 'disabled' : ''}
        onclick="dslRules.moveComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},direction:-1})"
        class="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1">↑</button>
      <button type="button" ${isLast ? 'disabled' : ''}
        onclick="dslRules.moveComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},direction:1})"
        class="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1">↓</button>
      <button type="button"
        onclick="dslRules.removeComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  return `<div class="flex items-center gap-1.5 mt-1">
    ${verbDropdown}
    ${operandInput}
    ${moveButtons}
  </div>`
}

function renderComputeFromEditor({
  stepId, ruleIndex, fieldKey, computeFrom, isReadOnly,
}) {
  const property = computeFrom?.property ?? ''
  const scope = computeFrom?.scope ?? 'scriptInfo'
  const ops = Array.isArray(computeFrom?.ops) ? computeFrom.ops : []
  const fieldKeyJson = JSON.stringify(fieldKey).replace(/"/g, '&quot;')
  const opRows = ops.map((op, opIndex) => renderComputeFromOpRow({
    stepId,
    ruleIndex,
    fieldKey,
    opIndex,
    op,
    isReadOnly,
    isFirst: opIndex === 0,
    isLast: opIndex === ops.length - 1,
  })).join('')
  const addOpButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.addComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson}})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ op</button>`
  const onPropertyInput = isReadOnly
    ? ''
    : `oninput="dslRules.setComputeFromField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},propertyName:'property',value:this.value})"`
  const onScopeChange = isReadOnly
    ? ''
    : `onchange="dslRules.setComputeFromField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},propertyName:'scope',value:this.value})"`
  return `<div class="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40 mt-1">
    <div class="flex items-center gap-2">
      <label class="text-xs text-slate-400">property</label>
      <input type="text" value="${esc(property)}" placeholder="PlayResY" ${isReadOnly ? 'readonly' : ''} ${onPropertyInput}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <label class="text-xs text-slate-400">scope</label>
      <select ${isReadOnly ? 'disabled' : ''} ${onScopeChange}
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
        <option value="scriptInfo"${scope === 'scriptInfo' ? ' selected' : ''}>scriptInfo</option>
        <option value="style"${scope === 'style' ? ' selected' : ''}>style</option>
      </select>
    </div>
    <div class="mt-1.5">
      <span class="text-xs uppercase tracking-wide text-slate-400">ops</span>
      ${opRows || '<p class="text-xs text-slate-500 italic mt-1">No ops yet.</p>'}
      ${addOpButton}
    </div>
  </div>`
}

function renderStyleFieldRow({
  stepId, ruleIndex, fieldKey, fieldValue, isReadOnly,
}) {
  const fieldKeyJson = JSON.stringify(fieldKey).replace(/"/g, '&quot;')
  const isComputed = isPlainObject(fieldValue) && isPlainObject(fieldValue.computeFrom)
  const literalValue = typeof fieldValue === 'string' ? fieldValue : ''
  const onKeyChange = isReadOnly
    ? ''
    : `onchange="dslRules.renameStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex},oldKey:${fieldKeyJson},newKey:this.value})"`
  const onLiteralInput = isReadOnly
    ? ''
    : `oninput="dslRules.setStyleFieldLiteralValue({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},value:this.value})"`
  const onComputedToggle = isReadOnly
    ? ''
    : `onchange="dslRules.setStyleFieldComputedToggle({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},isComputed:this.checked})"`
  const removeButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  return `<div class="border border-slate-700/40 rounded px-2 py-1.5 mt-1 bg-slate-900/20">
    <div class="flex items-center gap-1.5">
      <input type="text" value="${esc(fieldKey)}" placeholder="MarginV" ${isReadOnly ? 'readonly' : ''} ${onKeyChange}
        class="w-32 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <span class="text-slate-500 text-xs">=</span>
      ${isComputed
        ? '<span class="flex-1 text-xs text-slate-400 italic">computed from metadata ↓</span>'
        : `<input type="text" value="${esc(literalValue)}" placeholder="value" ${isReadOnly ? 'readonly' : ''} ${onLiteralInput}
            class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />`}
      <label class="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" ${isComputed ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} ${onComputedToggle}
          class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
        computed
      </label>
      ${removeButton}
    </div>
    ${isComputed ? renderComputeFromEditor({
      stepId, ruleIndex, fieldKey, computeFrom: fieldValue.computeFrom, isReadOnly,
    }) : ''}
  </div>`
}

function renderRuleBody({ stepId, ruleIndex, rule, predicates, isReadOnly }) {
  if (rule.type === 'setScriptInfo') {
    const onKeyInput = isReadOnly
      ? ''
      : `oninput="dslRules.setScriptInfoField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldName:'key',value:this.value})"`
    const onValueInput = isReadOnly
      ? ''
      : `oninput="dslRules.setScriptInfoField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldName:'value',value:this.value})"`
    return `<div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-slate-400 mb-1">Key</label>
        <input type="text" value="${esc(rule.key ?? '')}" placeholder="ScriptType" ${isReadOnly ? 'readonly' : ''} ${onKeyInput}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">Value</label>
        <input type="text" value="${esc(rule.value ?? '')}" placeholder="v4.00+" ${isReadOnly ? 'readonly' : ''} ${onValueInput}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
    </div>
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  if (rule.type === 'scaleResolution') {
    const fromGroup = isPlainObject(rule.from) ? rule.from : { width: 0, height: 0 }
    const toGroup = isPlainObject(rule.to) ? rule.to : { width: 0, height: 0 }
    const onDimensionInput = (group, dimension) => (
      isReadOnly
        ? ''
        : `oninput="dslRules.setScaleResolutionDimension({stepId:'${stepId}',ruleIndex:${ruleIndex},group:'${group}',dimension:'${dimension}',value:this.value===''?0:Number(this.value)})"`
    )
    const onFlagChange = isReadOnly
      ? ''
      : `onchange="dslRules.setScaleResolutionFlag({stepId:'${stepId}',ruleIndex:${ruleIndex},flagName:'hasScaledBorderAndShadow',value:this.checked})"`
    const isHasScaledBorderAndShadow = rule.hasScaledBorderAndShadow !== false
    return `<div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-slate-400 mb-1">From width</label>
        <input type="number" value="${esc(fromGroup.width ?? 0)}" ${isReadOnly ? 'readonly' : ''} ${onDimensionInput('from', 'width')}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">From height</label>
        <input type="number" value="${esc(fromGroup.height ?? 0)}" ${isReadOnly ? 'readonly' : ''} ${onDimensionInput('from', 'height')}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">To width</label>
        <input type="number" value="${esc(toGroup.width ?? 0)}" ${isReadOnly ? 'readonly' : ''} ${onDimensionInput('to', 'width')}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">To height</label>
        <input type="number" value="${esc(toGroup.height ?? 0)}" ${isReadOnly ? 'readonly' : ''} ${onDimensionInput('to', 'height')}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
    </div>
    <label class="flex items-center gap-2 mt-2 cursor-pointer text-xs text-slate-300">
      <input type="checkbox" ${isHasScaledBorderAndShadow ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} ${onFlagChange}
        class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
      hasScaledBorderAndShadow
    </label>
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  if (rule.type === 'setStyleFields') {
    const fields = isPlainObject(rule.fields) ? rule.fields : {}
    const fieldRows = Object.entries(fields).map(([fieldKey, fieldValue]) => (
      renderStyleFieldRow({
        stepId, ruleIndex, fieldKey, fieldValue, isReadOnly,
      })
    )).join('')
    const addFieldButton = isReadOnly
      ? ''
      : `<button type="button"
          onclick="dslRules.addStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex}})"
          class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ field</button>`
    const onIgnoredRegexInput = isReadOnly
      ? ''
      : `oninput="dslRules.setIgnoredStyleNamesRegex({stepId:'${stepId}',ruleIndex:${ruleIndex},value:this.value})"`
    return `<div>
      <label class="block text-xs text-slate-400 mb-1">Fields</label>
      ${fieldRows || '<p class="text-xs text-slate-500 italic">No fields yet.</p>'}
      ${addFieldButton}
    </div>
    <div class="mt-2">
      <label class="block text-xs text-slate-400 mb-1">ignoredStyleNamesRegexString</label>
      <input type="text" value="${esc(rule.ignoredStyleNamesRegexString ?? '')}" placeholder="signs?|op|ed" ${isReadOnly ? 'readonly' : ''} ${onIgnoredRegexInput}
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    </div>
    ${renderApplyIfBuilder({ stepId, ruleIndex, applyIfValue: rule.applyIf, isReadOnly })}
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  return `<p class="text-xs text-red-400">Unknown rule type: ${esc(rule.type)}</p>`
}

function renderRuleCard({
  stepId, ruleIndex, rule, predicates, isReadOnly, totalRules,
}) {
  const ruleType = rule.type ?? 'setScriptInfo'
  const onTypeChange = isReadOnly
    ? ''
    : `onchange="dslRules.changeRuleType({stepId:'${stepId}',ruleIndex:${ruleIndex},ruleType:this.value})"`
  const moveUpButton = isReadOnly || ruleIndex === 0
    ? '<button type="button" disabled class="text-xs text-slate-600 px-1 opacity-30">↑</button>'
    : `<button type="button"
        onclick="dslRules.moveRule({stepId:'${stepId}',ruleIndex:${ruleIndex},direction:-1})"
        class="text-xs text-slate-400 hover:text-slate-100 px-1">↑</button>`
  const moveDownButton = isReadOnly || ruleIndex >= totalRules - 1
    ? '<button type="button" disabled class="text-xs text-slate-600 px-1 opacity-30">↓</button>'
    : `<button type="button"
        onclick="dslRules.moveRule({stepId:'${stepId}',ruleIndex:${ruleIndex},direction:1})"
        class="text-xs text-slate-400 hover:text-slate-100 px-1">↓</button>`
  const removeButton = isReadOnly
    ? ''
    : `<button type="button"
        onclick="dslRules.removeRule({stepId:'${stepId}',ruleIndex:${ruleIndex}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const headerBackground = isReadOnly
    ? 'bg-slate-900/30'
    : 'bg-slate-800/60'
  const cardBackground = isReadOnly
    ? 'bg-slate-900/20 border-slate-700/40'
    : 'bg-slate-800/40 border-slate-700'
  const readOnlyBadge = isReadOnly
    ? '<span class="text-[10px] uppercase tracking-wide font-semibold text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded px-1.5 py-0.5">default</span>'
    : ''
  return `<div class="${cardBackground} border rounded px-2 py-2 mt-2">
    <div class="${headerBackground} -mx-2 -mt-2 px-2 py-1 mb-2 flex items-center gap-2 border-b border-slate-700/60 rounded-t">
      <span class="text-xs font-mono text-slate-500">${ruleIndex + 1}.</span>
      <select ${isReadOnly ? 'disabled' : ''} ${onTypeChange}
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
        ${RULE_TYPES.map((type) => `<option value="${type}"${type === ruleType ? ' selected' : ''}>${type}</option>`).join('')}
      </select>
      ${readOnlyBadge}
      <span class="flex-1"></span>
      ${moveUpButton}
      ${moveDownButton}
      ${removeButton}
    </div>
    ${renderRuleBody({ stepId, ruleIndex, rule, predicates, isReadOnly })}
  </div>`
}

function renderInsertRuleStrip({ stepId, insertIndex }) {
  return `<div class="flex items-center gap-1 mt-1">
    <div class="flex-1 h-px bg-slate-700/40"></div>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'setScriptInfo',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ setScriptInfo</button>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'scaleResolution',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ scaleResolution</button>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'setStyleFields',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ setStyleFields</button>
    <div class="flex-1 h-px bg-slate-700/40"></div>
  </div>`
}

function renderPredicatesManager({ stepId, predicates }) {
  const predicateNames = Object.keys(predicates)
  const renderEntry = ({ predicateName, entryKey, entryValue }) => {
    const entryKeyJson = JSON.stringify(entryKey).replace(/"/g, '&quot;')
    const onKeyChange = `onchange="dslRules.setPredicateEntryKey({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')},oldKey:${entryKeyJson},newKey:this.value})"`
    const onValueInput = `oninput="dslRules.setPredicateEntryValue({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')},entryKey:${entryKeyJson},value:this.value})"`
    const onRemove = `onclick="dslRules.removePredicateEntry({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')},entryKey:${entryKeyJson}})"`
    return `<div class="flex items-center gap-1.5 mt-1">
      <input type="text" value="${esc(entryKey)}" placeholder="key" ${onKeyChange}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <span class="text-slate-500 text-xs">=</span>
      <input type="text" value="${esc(entryValue)}" placeholder="value" ${onValueInput}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <button type="button" ${onRemove} class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>
    </div>`
  }
  const predicateCards = predicateNames.map((predicateName) => {
    const body = isPlainObject(predicates[predicateName]) ? predicates[predicateName] : {}
    const entries = Object.entries(body)
    const entryRows = entries.map(([entryKey, entryValue]) => renderEntry({ predicateName, entryKey, entryValue })).join('')
    const onNameChange = `onchange="dslRules.renamePredicate({stepId:'${stepId}',oldName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')},newName:this.value})"`
    const onRemove = `onclick="dslRules.removePredicate({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')}})"`
    const onAddEntry = `onclick="dslRules.addPredicateEntry({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, '&quot;')}})"`
    return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-slate-500">name</span>
        <input type="text" value="${esc(predicateName)}" ${onNameChange}
          class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
        <button type="button" ${onRemove} class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕ Remove</button>
      </div>
      ${entryRows || '<p class="text-xs text-slate-500 italic mt-1">No entries.</p>'}
      <button type="button" ${onAddEntry} class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>
    </div>`
  }).join('')
  const visibilityClass = predicateNames.length === 0 ? 'hidden' : ''
  return `<details class="mt-1 border border-slate-700/60 rounded">
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none flex items-center gap-2">
      <span>Predicates (named conditions reusable via $ref)</span>
      <span class="text-[10px] text-slate-500">${predicateNames.length} defined</span>
    </summary>
    <div class="px-2 py-1.5">
      <button type="button" onclick="dslRules.addPredicate({stepId:'${stepId}'})"
        class="text-xs text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-500/40 rounded px-2 py-0.5">+ Add predicate</button>
      <div class="${visibilityClass}">
        ${predicateCards}
      </div>
    </div>
  </details>`
}

// Tracks which step's Built-in Heuristic Rules details panel is currently open.
// Survives renderAll because it's module-level state, not DOM state.
const defaultRulesDetailsOpen = new Set()

export function renderRulesField({ step }) {
  const stepId = step.id
  const rules = Array.isArray(step.params.rules) ? step.params.rules : []
  const predicates = isPlainObject(step.params.predicates) ? step.params.predicates : {}
  const isHasDefaultRules = step.params.hasDefaultRules === true

  const onDefaultRulesToggle = `onchange="dslRules.setHasDefaultRules({stepId:'${stepId}',isEnabled:this.checked})"`

  const defaultRuleCards = isHasDefaultRules
    ? DEFAULT_RULES_PREVIEW.map((rule, defaultIndex) => renderRuleCard({
        stepId,
        ruleIndex: defaultIndex,
        rule,
        predicates,
        isReadOnly: true,
        totalRules: DEFAULT_RULES_PREVIEW.length,
      })).join('')
    : ''

  const defaultRulesSection = isHasDefaultRules
    ? `<div class="pl-2 border-l-2 border-amber-700/40">
        <p class="text-xs text-amber-300/80 mb-1">Read-only — run before user rules:</p>
        ${defaultRuleCards}
      </div>`
    : '<p class="text-xs text-slate-500 italic">Enable the checkbox above to use these rules.</p>'

  const ruleCards = rules.map((rule, ruleIndex) => {
    const card = renderRuleCard({
      stepId,
      ruleIndex,
      rule,
      predicates,
      isReadOnly: false,
      totalRules: rules.length,
    })
    const insertStrip = renderInsertRuleStrip({
      stepId,
      insertIndex: ruleIndex + 1,
    })
    return card + insertStrip
  }).join('')

  const headerInsertStrip = renderInsertRuleStrip({ stepId, insertIndex: 0 })

  // Details panel is open if the user manually opened it OR if hasDefaultRules
  // was just enabled (auto-open so they see what they're getting). The module-
  // level Set survives renderAll so predicate clicks don't collapse the panel.
  if (isHasDefaultRules) defaultRulesDetailsOpen.add(stepId)
  const detailsOpen = defaultRulesDetailsOpen.has(stepId) ? ' open' : ''

  return `<div class="dsl-rules-builder space-y-2" data-step="${stepId}" data-field="rules">
    <div class="flex items-center justify-between">
      <label class="text-xs text-slate-300 font-medium">Rules</label>
    </div>
    <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
      <input type="checkbox" ${isHasDefaultRules ? 'checked' : ''} ${onDefaultRulesToggle}
        class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-amber-500 cursor-pointer" />
      Prepend built-in heuristic rules
    </label>
    <details${detailsOpen} class="border border-slate-700 rounded"
      ontoggle="dslRules.onDefaultRulesDetailsToggle('${stepId}',this.open)">
      <summary class="cursor-pointer select-none px-2 py-1.5 text-xs text-slate-400 hover:text-slate-300 list-none flex items-center gap-1">
        <span class="text-slate-500">${detailsOpen ? '▾' : '▸'}</span>
        Built-in Heuristic Rules
      </summary>
      <div class="px-2 pb-2 pt-1 space-y-2">
        ${defaultRulesSection}
      </div>
    </details>
    ${renderPredicatesManager({ stepId, predicates })}
    ${rules.length === 0 ? `<p class="text-xs text-slate-500 italic mt-1">No user rules yet.</p>${headerInsertStrip}` : (headerInsertStrip + ruleCards)}
  </div>`
}

export function onDefaultRulesDetailsToggle(stepId, isOpen) {
  if (isOpen) {
    defaultRulesDetailsOpen.add(stepId)
  } else {
    defaultRulesDetailsOpen.delete(stepId)
  }
}

// ─── Window-global registration ───────────────────────────────────────────────
//
// All HTML onclick/oninput handlers in the rendered markup call into
// `dslRules.<name>(…)`. Mirrors the existing builder pattern of putting
// onclick targets on window. Single namespace object keeps the global
// surface tidy. Only invoked from renderRulesField output, so registering
// is safe to call lazily (main.js wires it up at startup).

export function registerDslRulesGlobals() {
  if (typeof window === 'undefined') {
    return
  }
  window.dslRules = {
    addPredicate,
    renamePredicate,
    removePredicate,
    addPredicateEntry,
    setPredicateEntryKey,
    setPredicateEntryValue,
    removePredicateEntry,

    addRule,
    removeRule,
    moveRule,
    changeRuleType,

    setScriptInfoField,

    setScaleResolutionDimension,
    setScaleResolutionFlag,

    addStyleField,
    renameStyleField,
    setStyleFieldLiteralValue,
    setStyleFieldComputedToggle,
    removeStyleField,
    setIgnoredStyleNamesRegex,

    setComputeFromField,
    addComputeFromOp,
    setComputeFromOpVerb,
    setComputeFromOpOperand,
    removeComputeFromOp,
    moveComputeFromOp,

    addWhenClause,
    removeWhenClause,
    setWhenClauseRef,
    addWhenEntry,
    setWhenEntryKey,
    setWhenEntryValue,
    removeWhenEntry,

    addApplyIfClause,
    removeApplyIfClause,
    addApplyIfEntry,
    setApplyIfEntryKey,
    setApplyIfEntryComparator,
    setApplyIfEntryOperand,
    removeApplyIfEntry,

    setHasDefaultRules,
    onDefaultRulesDetailsToggle,
  }
}
