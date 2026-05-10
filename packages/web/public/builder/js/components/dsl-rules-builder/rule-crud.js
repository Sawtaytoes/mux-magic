import { isPlainObject } from "./clause-utils.js"
import { RULE_TYPES } from "./constants.js"
import {
  bridge,
  commitPredicates,
  commitRules,
  findStepOrNull,
  generateFreshKey,
  getPredicates,
  getRules,
  makeEmptyRule,
  updateRuleAt,
} from "./state.js"

// ─── Predicates manager mutations ─────────────────────────────────────────────

export function addPredicate({ stepId }) {
  const current = getPredicates(stepId)
  const freshName = generateFreshKey({
    baseName: "predicate",
    usedNames: new Set(Object.keys(current)),
  })
  commitPredicates({
    stepId,
    nextPredicates: { ...current, [freshName]: {} },
  })
}

export function renamePredicate({
  stepId,
  oldName,
  newName,
}) {
  const trimmedNewName = (newName ?? "").trim()
  if (!trimmedNewName || oldName === trimmedNewName) {
    return
  }
  const current = getPredicates(stepId)
  if (!Object.hasOwn(current, oldName)) {
    return
  }
  if (Object.hasOwn(current, trimmedNewName)) {
    return
  }
  const next = {}
  Object.entries(current).forEach(
    ([predicateName, predicateBody]) => {
      if (predicateName === oldName) {
        next[trimmedNewName] = predicateBody
      } else {
        next[predicateName] = predicateBody
      }
    },
  )
  commitPredicates({ stepId, nextPredicates: next })
}

export function removePredicate({ stepId, predicateName }) {
  const current = getPredicates(stepId)
  const next = { ...current }
  delete next[predicateName]
  commitPredicates({ stepId, nextPredicates: next })
}

export function addPredicateEntry({
  stepId,
  predicateName,
}) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName])
    ? current[predicateName]
    : {}
  const finalKey = generateFreshKey({
    baseName: "key",
    usedNames: new Set(Object.keys(body)),
  })
  commitPredicates({
    stepId,
    nextPredicates: {
      ...current,
      [predicateName]: { ...body, [finalKey]: "" },
    },
  })
}

export function setPredicateEntryKey({
  stepId,
  predicateName,
  oldKey,
  newKey,
}) {
  const trimmed = (newKey ?? "").trim()
  if (!trimmed || trimmed === oldKey) {
    return
  }
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName])
    ? current[predicateName]
    : {}
  if (!Object.hasOwn(body, oldKey)) {
    return
  }
  if (Object.hasOwn(body, trimmed)) {
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
  commitPredicates({
    stepId,
    nextPredicates: {
      ...current,
      [predicateName]: nextBody,
    },
  })
}

export function setPredicateEntryValue({
  stepId,
  predicateName,
  entryKey,
  value,
}) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName])
    ? current[predicateName]
    : {}
  commitPredicates({
    stepId,
    nextPredicates: {
      ...current,
      [predicateName]: { ...body, [entryKey]: value },
    },
    isLiveEdit: true,
  })
}

export function removePredicateEntry({
  stepId,
  predicateName,
  entryKey,
}) {
  const current = getPredicates(stepId)
  const body = isPlainObject(current[predicateName])
    ? current[predicateName]
    : {}
  const nextBody = { ...body }
  delete nextBody[entryKey]
  commitPredicates({
    stepId,
    nextPredicates: {
      ...current,
      [predicateName]: nextBody,
    },
  })
}

// ─── Rules list mutations ─────────────────────────────────────────────────────

export function addRule({ stepId, ruleType, insertIndex }) {
  const current = getRules(stepId)
  const newRule = makeEmptyRule(ruleType ?? "setScriptInfo")
  const target =
    typeof insertIndex === "number"
      ? insertIndex
      : current.length
  commitRules({
    stepId,
    nextRules: [
      ...current.slice(0, target),
      newRule,
      ...current.slice(target),
    ],
  })
}

export function removeRule({ stepId, ruleIndex }) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: current.filter(
      (_, index) => index !== ruleIndex,
    ),
  })
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

export function changeRuleType({
  stepId,
  ruleIndex,
  ruleType,
}) {
  if (!RULE_TYPES.includes(ruleType)) {
    return
  }
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: () => makeEmptyRule(ruleType),
    }),
  })
}

// ─── setScriptInfo mutations ──────────────────────────────────────────────────

export function setScriptInfoField({
  stepId,
  ruleIndex,
  fieldName,
  value,
}) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => ({ ...rule, [fieldName]: value }),
    }),
    isLiveEdit: true,
  })
}

// ─── scaleResolution mutations ────────────────────────────────────────────────

export function setScaleResolutionDimension({
  stepId,
  ruleIndex,
  group,
  dimension,
  value,
}) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => {
        const groupValue = isPlainObject(rule[group])
          ? rule[group]
          : { width: 0, height: 0 }
        return {
          ...rule,
          [group]: { ...groupValue, [dimension]: value },
        }
      },
    }),
    isLiveEdit: true,
  })
}

export function setScaleResolutionFlag({
  stepId,
  ruleIndex,
  flagName,
  value,
}) {
  const current = getRules(stepId)
  commitRules({
    stepId,
    nextRules: updateRuleAt({
      rules: current,
      ruleIndex,
      updater: (rule) => ({ ...rule, [flagName]: value }),
    }),
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
