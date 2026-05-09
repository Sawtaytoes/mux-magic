// ─── DSL rules builder ────────────────────────────────────────────────────────
//
// Structured form editor for the modifySubtitleMetadata DSL. See sub-files:
//   dsl-rules-builder/constants.js       — exported constants + DEFAULT_RULES_PREVIEW
//   dsl-rules-builder/clause-utils.js    — when/applyIf clause normalization helpers
//   dsl-rules-builder/state.js           — step state accessors + mutation primitives
//   dsl-rules-builder/rule-crud.js       — predicates + rules list + simple rule mutations
//   dsl-rules-builder/style-mutations.js — setStyleFields field mutations
//   dsl-rules-builder/compute-mutations.js — computeFrom ops mutations
//   dsl-rules-builder/condition-mutations.js — when: and applyIf clause mutations
//   dsl-rules-builder/render.js          — all HTML rendering + renderRulesField

export {
  RULE_TYPES,
  WHEN_CLAUSE_NAMES,
  APPLY_IF_CLAUSE_NAMES,
  COMPARATOR_VERBS,
  COMPUTE_FROM_OPS_WITH_OPERAND,
  COMPUTE_FROM_OPS_BARE,
  COMPUTE_FROM_OPS_ALL,
  DEFAULT_RULES_PREVIEW,
} from './dsl-rules-builder/constants.js'

export { normalizeWhenClause, compactWhenClause, isRefBody } from './dsl-rules-builder/clause-utils.js'
export { makeEmptyRule } from './dsl-rules-builder/state.js'

import {
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
  setHasDefaultRules,
} from './dsl-rules-builder/rule-crud.js'

import {
  addStyleField,
  renameStyleField,
  setStyleFieldLiteralValue,
  setStyleFieldComputedToggle,
  removeStyleField,
  setIgnoredStyleNamesRegex,
} from './dsl-rules-builder/style-mutations.js'

import {
  setComputeFromField,
  addComputeFromOp,
  setComputeFromOpVerb,
  setComputeFromOpOperand,
  removeComputeFromOp,
  moveComputeFromOp,
} from './dsl-rules-builder/compute-mutations.js'

import {
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
} from './dsl-rules-builder/condition-mutations.js'

export {
  addPredicate, renamePredicate, removePredicate,
  addPredicateEntry, setPredicateEntryKey, setPredicateEntryValue, removePredicateEntry,
  addRule, removeRule, moveRule, changeRuleType,
  setScriptInfoField, setScaleResolutionDimension, setScaleResolutionFlag,
  setHasDefaultRules,
}

export {
  addStyleField, renameStyleField, setStyleFieldLiteralValue,
  setStyleFieldComputedToggle, removeStyleField, setIgnoredStyleNamesRegex,
}

export {
  setComputeFromField, addComputeFromOp, setComputeFromOpVerb,
  setComputeFromOpOperand, removeComputeFromOp, moveComputeFromOp,
}

export {
  addWhenClause, removeWhenClause, setWhenClauseRef,
  addWhenEntry, setWhenEntryKey, setWhenEntryValue, removeWhenEntry,
  addApplyIfClause, removeApplyIfClause, addApplyIfEntry,
  setApplyIfEntryKey, setApplyIfEntryComparator, setApplyIfEntryOperand, removeApplyIfEntry,
}

import { renderRulesField, onDetailsToggle } from './dsl-rules-builder/render.js'
export { renderRulesField, onDetailsToggle }

export function registerDslRulesGlobals() {
  if (typeof window === 'undefined') { return }
  window.dslRules = {
    onDetailsToggle,
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
  }
}
