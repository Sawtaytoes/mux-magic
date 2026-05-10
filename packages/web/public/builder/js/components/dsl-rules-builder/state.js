import { isPlainObject } from "./clause-utils.js"

export const bridge = () => window.mediaTools

export function findStepOrNull(stepId) {
  return bridge().findStepById?.(stepId) ?? null
}

export function getRules(stepId) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return []
  }
  const rules = step.params.rules
  return Array.isArray(rules) ? rules : []
}

export function getPredicates(stepId) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return {}
  }
  const predicates = step.params.predicates
  return isPlainObject(predicates) ? predicates : {}
}

export function commitRules({
  stepId,
  nextRules,
  isLiveEdit = false,
}) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return
  }
  if (Array.isArray(nextRules) && nextRules.length > 0) {
    step.params.rules = nextRules
  } else {
    delete step.params.rules
  }
  if (isLiveEdit) {
    bridge().scheduleUpdateUrl?.()
  } else {
    bridge().renderAll?.()
  }
}

export function commitPredicates({
  stepId,
  nextPredicates,
  isLiveEdit = false,
}) {
  const step = findStepOrNull(stepId)
  if (!step) {
    return
  }
  if (
    isPlainObject(nextPredicates) &&
    Object.keys(nextPredicates).length > 0
  ) {
    step.params.predicates = nextPredicates
  } else {
    delete step.params.predicates
  }
  if (isLiveEdit) {
    bridge().scheduleUpdateUrl?.()
  } else {
    bridge().renderAll?.()
  }
}

// Pick the first `<baseName>`, `<baseName>2`, `<baseName>3`, … not already in `usedNames`.
export function generateFreshKey({ baseName, usedNames }) {
  const buildCandidate = (suffixIndex) =>
    suffixIndex === 0
      ? baseName
      : `${baseName}${suffixIndex + 1}`
  const indexes = Array.from(
    { length: 64 },
    (_, position) => position,
  )
  const found = indexes.find(
    (suffixIndex) =>
      !usedNames.has(buildCandidate(suffixIndex)),
  )
  if (found === undefined) {
    return `${baseName}${usedNames.size + 1}`
  }
  return buildCandidate(found)
}

export function makeEmptyRule(ruleType) {
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
  if (ruleType === "setStyleFields") {
    return { type: "setStyleFields", fields: {} }
  }
  return { type: ruleType }
}

export function updateRuleAt({
  rules,
  ruleIndex,
  updater,
}) {
  return rules.map((rule, index) =>
    index === ruleIndex ? updater(rule) : rule,
  )
}
