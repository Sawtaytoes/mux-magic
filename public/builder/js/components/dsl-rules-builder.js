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
  compactWhenClause,
  isRefBody,
  normalizeWhenClause,
} from "./dsl-rules-builder/clause-utils.js"
export {
  APPLY_IF_CLAUSE_NAMES,
  COMPARATOR_VERBS,
  COMPUTE_FROM_OPS_ALL,
  COMPUTE_FROM_OPS_BARE,
  COMPUTE_FROM_OPS_WITH_OPERAND,
  DEFAULT_RULES_PREVIEW,
  RULE_TYPES,
  WHEN_CLAUSE_NAMES,
} from "./dsl-rules-builder/constants.js"
export { makeEmptyRule } from "./dsl-rules-builder/state.js"

import {
  addComputeFromOp,
  moveComputeFromOp,
  removeComputeFromOp,
  setComputeFromField,
  setComputeFromOpOperand,
  setComputeFromOpVerb,
} from "./dsl-rules-builder/compute-mutations.js"
import {
  addApplyIfClause,
  addApplyIfEntry,
  addWhenClause,
  addWhenEntry,
  removeApplyIfClause,
  removeApplyIfEntry,
  removeWhenClause,
  removeWhenEntry,
  setApplyIfEntryComparator,
  setApplyIfEntryKey,
  setApplyIfEntryOperand,
  setWhenClauseRef,
  setWhenEntryKey,
  setWhenEntryValue,
} from "./dsl-rules-builder/condition-mutations.js"
import {
  addPredicate,
  addPredicateEntry,
  addRule,
  changeRuleType,
  moveRule,
  removePredicate,
  removePredicateEntry,
  removeRule,
  renamePredicate,
  setHasDefaultRules,
  setPredicateEntryKey,
  setPredicateEntryValue,
  setScaleResolutionDimension,
  setScaleResolutionFlag,
  setScriptInfoField,
} from "./dsl-rules-builder/rule-crud.js"
import {
  addStyleField,
  removeStyleField,
  renameStyleField,
  setIgnoredStyleNamesRegex,
  setStyleFieldComputedToggle,
  setStyleFieldLiteralValue,
} from "./dsl-rules-builder/style-mutations.js"

export {
  addApplyIfClause,
  addApplyIfEntry,
  addComputeFromOp,
  addPredicate,
  addPredicateEntry,
  addRule,
  addStyleField,
  addWhenClause,
  addWhenEntry,
  changeRuleType,
  moveComputeFromOp,
  moveRule,
  removeApplyIfClause,
  removeApplyIfEntry,
  removeComputeFromOp,
  removePredicate,
  removePredicateEntry,
  removeRule,
  removeStyleField,
  removeWhenClause,
  removeWhenEntry,
  renamePredicate,
  renameStyleField,
  setApplyIfEntryComparator,
  setApplyIfEntryKey,
  setApplyIfEntryOperand,
  setComputeFromField,
  setComputeFromOpOperand,
  setComputeFromOpVerb,
  setHasDefaultRules,
  setIgnoredStyleNamesRegex,
  setPredicateEntryKey,
  setPredicateEntryValue,
  setScaleResolutionDimension,
  setScaleResolutionFlag,
  setScriptInfoField,
  setStyleFieldComputedToggle,
  setStyleFieldLiteralValue,
  setWhenClauseRef,
  setWhenEntryKey,
  setWhenEntryValue,
}

import {
  onDetailsToggle,
  renderRulesField,
} from "./dsl-rules-builder/render.js"

export { onDetailsToggle, renderRulesField }

export function registerDslRulesGlobals() {
  if (typeof window === "undefined") {
    return
  }
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
