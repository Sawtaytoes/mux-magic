import {
  changeRuleType,
  moveRule,
  removeRule,
} from "./ruleMutations"
import { ScaleResolutionRuleBody } from "./ScaleResolutionRule"
import { SetScriptInfoRuleBody } from "./SetScriptInfoRule"
import { SetStyleFieldsRuleBody } from "./SetStyleFieldsRule"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  ScaleResolutionRule,
  SetScriptInfoRule,
  SetStyleFieldsRule,
} from "./types"
import { RULE_TYPES } from "./types"

type RuleCardProps = {
  rules: DslRule[]
  ruleIndex: number
  rule: DslRule
  predicates: PredicatesMap
  isReadOnly: boolean
  isFirst: boolean
  isLast: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const RuleCard = ({
  rules,
  ruleIndex,
  rule,
  predicates,
  isReadOnly,
  isFirst,
  isLast,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: RuleCardProps) => (
  <div className="border border-slate-700 rounded px-3 py-2 bg-slate-800/60">
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 font-mono shrink-0">
        #{ruleIndex + 1}
      </span>
      {isReadOnly ? (
        <span className="text-xs font-mono text-blue-300">
          {rule.type}
        </span>
      ) : (
        <select
          value={rule.type}
          onChange={(event) => {
            onCommitRules(
              changeRuleType({
                rules,
                ruleIndex,
                ruleType: event.target
                  .value as (typeof RULE_TYPES)[number],
              }),
            )
          }}
          className="text-xs bg-slate-700 text-blue-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        >
          {RULE_TYPES.map((ruleType) => (
            <option key={ruleType} value={ruleType}>
              {ruleType}
            </option>
          ))}
        </select>
      )}
      <div className="flex-1" />
      {isReadOnly && (
        <span className="text-[10px] text-slate-500 italic">
          read-only
        </span>
      )}
      {!isReadOnly && (
        <>
          <button
            type="button"
            disabled={isFirst}
            onClick={() => {
              onCommitRules(
                moveRule({
                  rules,
                  ruleIndex,
                  direction: -1,
                }),
              )
            }}
            className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => {
              onCommitRules(
                moveRule({
                  rules,
                  ruleIndex,
                  direction: 1,
                }),
              )
            }}
            className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => {
              onCommitRules(
                removeRule({ rules, ruleIndex }),
              )
            }}
            className="text-xs text-slate-500 hover:text-red-400 px-1.5"
          >
            ✕
          </button>
        </>
      )}
    </div>
    {rule.type === "setScriptInfo" && (
      <SetScriptInfoRuleBody
        rules={rules}
        ruleIndex={ruleIndex}
        rule={rule as SetScriptInfoRule}
        predicates={predicates}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
    )}
    {rule.type === "scaleResolution" && (
      <ScaleResolutionRuleBody
        rules={rules}
        ruleIndex={ruleIndex}
        rule={rule as ScaleResolutionRule}
        predicates={predicates}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
    )}
    {rule.type === "setStyleFields" && (
      <SetStyleFieldsRuleBody
        rules={rules}
        ruleIndex={ruleIndex}
        rule={rule as SetStyleFieldsRule}
        predicates={predicates}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
    )}
  </div>
)
