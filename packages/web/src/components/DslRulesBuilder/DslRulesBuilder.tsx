import { useRef, useState } from "react"

import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { InsertRuleStrip } from "./InsertRuleStrip"
import { PredicatesManager } from "./PredicatesManager"
import { RuleCard } from "./RuleCard"
import { addRule } from "./ruleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  RuleType,
} from "./types"

type DslRulesBuilderProps = {
  step: Step
  isReadOnly?: boolean
}

export const DslRulesBuilder = ({
  step,
  isReadOnly = false,
}: DslRulesBuilderProps) => {
  const { setParam } = useBuilderActions()

  const rules = Array.isArray(step.params.rules)
    ? (step.params.rules as DslRule[])
    : []
  const predicates =
    step.params.predicates != null &&
    typeof step.params.predicates === "object" &&
    !Array.isArray(step.params.predicates)
      ? (step.params.predicates as PredicatesMap)
      : {}

  // Rule keys, by object identity FIRST and by position as a fallback.
  //
  // Identity alone was enough while every rule body was prop-controlled.
  // It stopped being enough when `when:`/`applyIf:` moved to `QueryBuilder`:
  // that editor holds tree state of its own, and an edit runs through
  // `updateRuleAt`, which returns a NEW rule object at that index. A fresh
  // key there remounts the whole card and throws the tree away — the row
  // you just added vanishes on the commit that added it.
  //
  // Identity still comes first because `moveRule` reorders the SAME
  // objects, so their keys travel with them and the view transition can
  // animate a move. The positional fallback only catches an edit in place,
  // and it refuses a key another rule in this render already claimed —
  // otherwise inserting mid-list would hand two rules the same key.
  const ruleKeyMap = useRef(new WeakMap<DslRule, string>())
  const previousRuleKeys = useRef<string[]>([])

  const claimedKeys = new Set<string>()

  const ruleKeys: string[] = rules.map((rule) => {
    const existingKey = ruleKeyMap.current.get(rule)

    if (
      existingKey !== undefined &&
      !claimedKeys.has(existingKey)
    ) {
      claimedKeys.add(existingKey)
      return existingKey
    }

    return ""
  })

  rules.forEach((rule, ruleIndex) => {
    if (ruleKeys[ruleIndex] !== "") {
      return
    }

    const inheritedKey = previousRuleKeys.current[ruleIndex]

    const nextKey =
      inheritedKey !== undefined &&
      !claimedKeys.has(inheritedKey)
        ? inheritedKey
        : crypto.randomUUID()

    claimedKeys.add(nextKey)
    ruleKeyMap.current.set(rule, nextKey)
    ruleKeys[ruleIndex] = nextKey
  })

  previousRuleKeys.current = ruleKeys

  const getRuleKey = (ruleIndex: number) =>
    ruleKeys[ruleIndex] ?? ""

  const [openDetailsKeys, setOpenDetailsKeys] =
    useState<OpenDetailsKeys>(new Set())

  const handleToggleDetails = (
    detailsKey: string,
    isOpen: boolean,
  ) => {
    setOpenDetailsKeys((prev) => {
      const next = new Set(prev)
      if (isOpen) {
        next.add(detailsKey)
      } else {
        next.delete(detailsKey)
      }
      return next
    })
  }

  const handleCommitRules = (nextRules: DslRule[]) => {
    setParam(step.id, "rules", nextRules)
  }

  const handleCommitPredicates = (
    nextPredicates: PredicatesMap,
  ) => {
    setParam(
      step.id,
      "predicates",
      Object.keys(nextPredicates).length > 0
        ? nextPredicates
        : undefined,
    )
  }

  const handleAddRule = (ruleType: RuleType) => {
    handleCommitRules(addRule({ rules, ruleType }))
  }

  return (
    <div className="mt-1">
      <PredicatesManager
        predicates={predicates}
        isReadOnly={isReadOnly}
        stepId={step.id}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={handleToggleDetails}
        onCommitPredicates={handleCommitPredicates}
      />

      <div className="mt-3 space-y-2">
        {rules.map((rule, ruleIndex) => (
          <div key={getRuleKey(ruleIndex)}>
            <RuleCard
              rules={rules}
              ruleIndex={ruleIndex}
              rule={rule}
              ruleKey={getRuleKey(ruleIndex)}
              predicates={predicates}
              isReadOnly={isReadOnly}
              isFirst={ruleIndex === 0}
              isLast={ruleIndex === rules.length - 1}
              stepId={step.id}
              openDetailsKeys={openDetailsKeys}
              onToggleDetails={handleToggleDetails}
              onCommitRules={handleCommitRules}
            />
            {!isReadOnly && (
              <InsertRuleStrip
                onAddRule={(ruleType) => {
                  handleCommitRules(
                    addRule({
                      rules,
                      ruleType,
                      insertIndex: ruleIndex + 1,
                    }),
                  )
                }}
              />
            )}
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <>
          <p className="text-xs text-content-muted italic mt-2">
            No rules yet.
          </p>
          {!isReadOnly && (
            <InsertRuleStrip onAddRule={handleAddRule} />
          )}
        </>
      )}
    </div>
  )
}
