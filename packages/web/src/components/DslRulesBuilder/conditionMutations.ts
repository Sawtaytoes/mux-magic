import {
  compactWhenClause,
  isPlainObject,
  isRefBody,
  normalizeWhenClause,
} from "./clauseUtils"
import { generateFreshKey } from "./generateFreshKey"
import { updateRuleAt } from "./ruleMutations"
import {
  APPLY_IF_CLAUSE_NAMES,
  type ApplyIfClauseName,
  type ApplyIfEntry,
  type ApplyIfMap,
  COMPARATOR_VERBS,
  type ComparatorVerb,
  type DslRule,
  type SetStyleFieldsRule,
  WHEN_CLAUSE_NAMES,
  type WhenClauseName,
  type WhenClauseValue,
  type WhenMap,
} from "./types"

// ─── when: helpers ────────────────────────────────────────────────────────────

const applyWhenMutator = ({
  rules,
  ruleIndex,
  mutator,
}: {
  rules: DslRule[]
  ruleIndex: number
  mutator: (when: WhenMap) => WhenMap
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const when = isPlainObject(rule.when)
        ? (rule.when as WhenMap)
        : {}
      const nextWhen = mutator(when)
      const isWhenEmpty =
        !isPlainObject(nextWhen) ||
        Object.keys(nextWhen).length === 0
      const nextRule = { ...rule }
      if (isWhenEmpty) {
        delete nextRule.when
      } else {
        nextRule.when = nextWhen
      }
      return nextRule
    },
  })

// ─── when: mutations ──────────────────────────────────────────────────────────

export const addWhenClause = ({
  rules,
  ruleIndex,
  clauseName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
}): DslRule[] => {
  if (!WHEN_CLAUSE_NAMES.includes(clauseName)) {
    return rules
  }
  return applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      if (Object.hasOwn(when, clauseName)) {
        return when
      }
      return {
        ...when,
        [clauseName]: { matches: {}, excludes: null },
      }
    },
  })
}

export const removeWhenClause = ({
  rules,
  ruleIndex,
  clauseName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
}): DslRule[] =>
  applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const nextWhen = { ...when }
      delete nextWhen[clauseName]
      return nextWhen
    },
  })

export const setWhenClauseRef = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  refName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  refName: string
}): DslRule[] =>
  applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const nextSlotValue = refName ? { $ref: refName } : {}
      const nextClause = {
        ...clause,
        [slot]: nextSlotValue,
      }
      return {
        ...when,
        [clauseName]: (compactWhenClause(
          nextClause,
        ) as WhenClauseValue) ?? {
          matches: {},
          excludes: null,
        },
      }
    },
  })

export const addWhenEntry = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
}): DslRule[] =>
  applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody =
        isPlainObject(clause[slot]) &&
        !isRefBody(clause[slot])
          ? (clause[slot] as Record<string, string>)
          : {}
      const finalKey = generateFreshKey({
        baseName: "key",
        usedNames: new Set(Object.keys(slotBody)),
      })
      const nextClause = {
        ...clause,
        [slot]: { ...slotBody, [finalKey]: "" },
      }
      return {
        ...when,
        [clauseName]: (compactWhenClause(
          nextClause,
        ) as WhenClauseValue) ?? {
          matches: {},
          excludes: null,
        },
      }
    },
  })

export const setWhenEntryKey = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  oldKey,
  newKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  oldKey: string
  newKey: string
}): DslRule[] => {
  const trimmed = (newKey ?? "").trim()
  if (!trimmed || trimmed === oldKey) {
    return rules
  }
  return applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody =
        isPlainObject(clause[slot]) &&
        !isRefBody(clause[slot])
          ? (clause[slot] as Record<string, string>)
          : {}
      if (!Object.hasOwn(slotBody, oldKey)) {
        return when
      }
      if (Object.hasOwn(slotBody, trimmed)) {
        return when
      }
      const nextSlotBody: Record<string, string> = {}
      Object.entries(slotBody).forEach(
        ([entryKey, entryValue]) => {
          if (entryKey === oldKey) {
            nextSlotBody[trimmed] = entryValue
          } else {
            nextSlotBody[entryKey] = entryValue
          }
        },
      )
      const nextClause = { ...clause, [slot]: nextSlotBody }
      return {
        ...when,
        [clauseName]: (compactWhenClause(
          nextClause,
        ) as WhenClauseValue) ?? {
          matches: {},
          excludes: null,
        },
      }
    },
  })
}

export const setWhenEntryValue = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  entryKey,
  value,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  entryKey: string
  value: string
}): DslRule[] =>
  applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody =
        isPlainObject(clause[slot]) &&
        !isRefBody(clause[slot])
          ? (clause[slot] as Record<string, string>)
          : {}
      const nextClause = {
        ...clause,
        [slot]: { ...slotBody, [entryKey]: value },
      }
      return {
        ...when,
        [clauseName]: (compactWhenClause(
          nextClause,
        ) as WhenClauseValue) ?? {
          matches: {},
          excludes: null,
        },
      }
    },
  })

export const removeWhenEntry = ({
  rules,
  ruleIndex,
  clauseName,
  slot,
  entryKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: WhenClauseName
  slot: "matches" | "excludes"
  entryKey: string
}): DslRule[] =>
  applyWhenMutator({
    rules,
    ruleIndex,
    mutator: (when) => {
      const clause = normalizeWhenClause(when[clauseName])
      const slotBody =
        isPlainObject(clause[slot]) &&
        !isRefBody(clause[slot])
          ? (clause[slot] as Record<string, string>)
          : {}
      const nextSlotBody = { ...slotBody }
      delete nextSlotBody[entryKey]
      const nextClause = { ...clause, [slot]: nextSlotBody }
      return {
        ...when,
        [clauseName]: (compactWhenClause(
          nextClause,
        ) as WhenClauseValue) ?? {
          matches: {},
          excludes: null,
        },
      }
    },
  })

// ─── applyIf: helpers ─────────────────────────────────────────────────────────

const applyApplyIfMutator = ({
  rules,
  ruleIndex,
  mutator,
}: {
  rules: DslRule[]
  ruleIndex: number
  mutator: (applyIf: ApplyIfMap) => ApplyIfMap
}): DslRule[] =>
  updateRuleAt({
    rules,
    ruleIndex,
    updater: (rule) => {
      const styleRule = rule as SetStyleFieldsRule
      const applyIf = isPlainObject(styleRule.applyIf)
        ? (styleRule.applyIf as ApplyIfMap)
        : {}
      const nextApplyIf = mutator(applyIf)
      const isApplyIfEmpty =
        !isPlainObject(nextApplyIf) ||
        Object.keys(nextApplyIf).length === 0
      const nextRule = { ...styleRule }
      if (isApplyIfEmpty) {
        delete nextRule.applyIf
      } else {
        nextRule.applyIf = nextApplyIf
      }
      return nextRule
    },
  })

// ─── applyIf: mutations ───────────────────────────────────────────────────────

export const addApplyIfClause = ({
  rules,
  ruleIndex,
  clauseName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
}): DslRule[] => {
  if (!APPLY_IF_CLAUSE_NAMES.includes(clauseName)) {
    return rules
  }
  return applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      if (Object.hasOwn(applyIf, clauseName)) {
        return applyIf
      }
      return { ...applyIf, [clauseName]: {} }
    },
  })
}

export const removeApplyIfClause = ({
  rules,
  ruleIndex,
  clauseName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
}): DslRule[] =>
  applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const nextApplyIf = { ...applyIf }
      delete nextApplyIf[clauseName]
      return nextApplyIf
    },
  })

export const addApplyIfEntry = ({
  rules,
  ruleIndex,
  clauseName,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
}): DslRule[] =>
  applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName])
        ? (applyIf[clauseName] as Record<
            string,
            ApplyIfEntry
          >)
        : {}
      const finalKey = generateFreshKey({
        baseName: "Field",
        usedNames: new Set(Object.keys(clause)),
      })
      return {
        ...applyIf,
        [clauseName]: { ...clause, [finalKey]: { eq: 0 } },
      }
    },
  })

export const setApplyIfEntryKey = ({
  rules,
  ruleIndex,
  clauseName,
  oldKey,
  newKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  oldKey: string
  newKey: string
}): DslRule[] => {
  const trimmed = (newKey ?? "").trim()
  if (!trimmed || trimmed === oldKey) {
    return rules
  }
  return applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName])
        ? (applyIf[clauseName] as Record<
            string,
            ApplyIfEntry
          >)
        : {}
      if (!Object.hasOwn(clause, oldKey)) {
        return applyIf
      }
      if (Object.hasOwn(clause, trimmed)) {
        return applyIf
      }
      const nextClause: Record<string, ApplyIfEntry> = {}
      Object.entries(clause).forEach(
        ([entryKey, entryValue]) => {
          if (entryKey === oldKey) {
            nextClause[trimmed] = entryValue
          } else {
            nextClause[entryKey] = entryValue
          }
        },
      )
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
}

export const setApplyIfEntryComparator = ({
  rules,
  ruleIndex,
  clauseName,
  entryKey,
  verb,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  entryKey: string
  verb: ComparatorVerb
}): DslRule[] => {
  if (!COMPARATOR_VERBS.includes(verb)) {
    return rules
  }
  return applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName])
        ? (applyIf[clauseName] as Record<
            string,
            ApplyIfEntry
          >)
        : {}
      const existingEntry = clause[entryKey]
      const previousOperand = isPlainObject(existingEntry)
        ? Object.values(existingEntry)[0]
        : 0
      const operand =
        typeof previousOperand === "number"
          ? previousOperand
          : 0
      return {
        ...applyIf,
        [clauseName]: {
          ...clause,
          [entryKey]: { [verb]: operand },
        },
      }
    },
  })
}

export const setApplyIfEntryOperand = ({
  rules,
  ruleIndex,
  clauseName,
  entryKey,
  operand,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  entryKey: string
  operand: number
}): DslRule[] =>
  applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName])
        ? (applyIf[clauseName] as Record<
            string,
            ApplyIfEntry
          >)
        : {}
      const existingEntry = clause[entryKey]
      if (!isPlainObject(existingEntry)) {
        return applyIf
      }
      const verb = Object.keys(
        existingEntry,
      )[0] as ComparatorVerb
      if (!verb) {
        return applyIf
      }
      return {
        ...applyIf,
        [clauseName]: {
          ...clause,
          [entryKey]: { [verb]: operand },
        },
      }
    },
  })

export const removeApplyIfEntry = ({
  rules,
  ruleIndex,
  clauseName,
  entryKey,
}: {
  rules: DslRule[]
  ruleIndex: number
  clauseName: ApplyIfClauseName
  entryKey: string
}): DslRule[] =>
  applyApplyIfMutator({
    rules,
    ruleIndex,
    mutator: (applyIf) => {
      const clause = isPlainObject(applyIf[clauseName])
        ? (applyIf[clauseName] as Record<
            string,
            ApplyIfEntry
          >)
        : {}
      const nextClause = { ...clause }
      delete nextClause[entryKey]
      return { ...applyIf, [clauseName]: nextClause }
    },
  })
