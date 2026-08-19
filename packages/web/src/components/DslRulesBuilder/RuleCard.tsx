import { IconButton, Select } from "@charcuterie/ui"
import { runWithViewTransition } from "../../utils/runWithViewTransition"
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
  ruleKey: string
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
  ruleKey,
  predicates,
  isReadOnly,
  isFirst,
  isLast,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: RuleCardProps) => (
  <div
    data-rule-key={ruleIndex}
    style={{ viewTransitionName: `rule-${ruleKey}` }}
    className="border border-border-default rounded px-3 py-2 bg-surface-raised"
  >
    <div className="flex items-center gap-2">
      <span className="text-xs text-content-muted font-mono shrink-0">
        #{ruleIndex + 1}
      </span>
      {isReadOnly ? (
        <span className="text-xs font-mono text-intent-accent-content">
          {rule.type}
        </span>
      ) : (
        // 13rem = 208px, and the number is measured, not chosen:
        // `scaleResolution` is the widest option and needs 194px at
        // this font. It sits on `Select` itself now — `className` is
        // the control's outer box as of `@charcuterie/ui@3`, chevron
        // included (charcuterie#112), so the wrapping `<div>` this
        // used to need is gone. `font-mono` is about the option text
        // rather than the box, so it moves to `controlClassName`.
        <Select
          className="w-52 shrink-0"
          controlClassName="font-mono"
          // Rule rows are keyed by `ruleKey`, but the rules array is
          // replaced wholesale on every commit and a rule can also arrive
          // from a loaded template or an undo. `Select` is uncontrolled by
          // design, so the DOM has to be re-seeded when the type it is
          // showing was not the user's own choice.
          key={rule.type}
          label={`Rule ${ruleIndex + 1} type`}
          onChange={(ruleType) => {
            onCommitRules(
              changeRuleType({
                rules,
                ruleIndex,
                ruleType:
                  ruleType as (typeof RULE_TYPES)[number],
              }),
            )
          }}
          options={RULE_TYPES.map((ruleType) => ({
            label: ruleType,
            value: ruleType,
          }))}
          size="sm"
          value={rule.type}
        />
      )}
      <div className="flex-1" />
      {isReadOnly && (
        <span className="text-[10px] text-content-muted italic">
          read-only
        </span>
      )}
      {!isReadOnly && (
        <>
          <IconButton
            label="Move rule up"
            intent="neutral"
            appearance="ghost"
            size="sm"
            isDisabled={isFirst}
            onClick={() => {
              runWithViewTransition(() => {
                onCommitRules(
                  moveRule({
                    rules,
                    ruleIndex,
                    direction: -1,
                  }),
                )
              })
            }}
          >
            ↑
          </IconButton>
          <IconButton
            label="Move rule down"
            intent="neutral"
            appearance="ghost"
            size="sm"
            isDisabled={isLast}
            onClick={() => {
              runWithViewTransition(() => {
                onCommitRules(
                  moveRule({
                    rules,
                    ruleIndex,
                    direction: 1,
                  }),
                )
              })
            }}
          >
            ↓
          </IconButton>
          <IconButton
            label="Remove rule"
            intent="danger"
            appearance="ghost"
            size="sm"
            onClick={() => {
              runWithViewTransition(() => {
                onCommitRules(
                  removeRule({ rules, ruleIndex }),
                )
              })
            }}
          >
            ✕
          </IconButton>
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
