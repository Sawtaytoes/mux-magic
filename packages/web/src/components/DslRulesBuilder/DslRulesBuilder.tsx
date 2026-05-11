import { useRef, useState } from "react"

import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { InsertRuleStrip } from "./InsertRuleStrip"
import { PredicatesManager } from "./PredicatesManager"
import { RuleCard } from "./RuleCard"
import {
  addRule,
  nextHasDefaultRules,
} from "./ruleMutations"
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
  const isHasDefaultRules =
    step.params.hasDefaultRules === true

  const ruleKeyMap = useRef(new WeakMap<DslRule, string>())
  const getRuleKey = (rule: DslRule): string => {
    const existing = ruleKeyMap.current.get(rule)
    if (existing !== undefined) {
      return existing
    }
    const freshId = crypto.randomUUID()
    ruleKeyMap.current.set(rule, freshId)
    return freshId
  }

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
      <label className="flex items-center gap-2 mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isHasDefaultRules}
          disabled={isReadOnly}
          onChange={(event) => {
            setParam(
              step.id,
              "hasDefaultRules",
              nextHasDefaultRules(event.target.checked),
            )
          }}
          className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400">
          hasDefaultRules
        </span>
      </label>

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
          <div key={getRuleKey(rule)}>
            <RuleCard
              rules={rules}
              ruleIndex={ruleIndex}
              rule={rule}
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
          <p className="text-xs text-slate-500 italic mt-2">
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
