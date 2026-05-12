import { useState } from "react"

import { ApplyIfBuilder } from "./ApplyIfBuilder"
import { setIgnoredStyleNamesRegex } from "./ruleMutations"
import { StyleFieldRow } from "./StyleFieldRow"
import { addStyleField } from "./styleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  SetStyleFieldsRule as SetStyleFieldsRuleType,
} from "./types"
import { WhenBuilder } from "./WhenBuilder"

type SetStyleFieldsRuleProps = {
  rules: DslRule[]
  ruleIndex: number
  rule: SetStyleFieldsRuleType
  predicates: PredicatesMap
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const SetStyleFieldsRuleBody = ({
  rules,
  ruleIndex,
  rule,
  predicates,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: SetStyleFieldsRuleProps) => {
  const fields = rule.fields ?? {}
  const [draftRegex, setDraftRegex] = useState(
    rule.ignoredStyleNamesRegexString ?? "",
  )

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          fields
        </span>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              onCommitRules(
                addStyleField({ rules, ruleIndex }),
              )
            }}
            className="text-xs text-slate-400 hover:text-blue-400"
          >
            + field
          </button>
        )}
      </div>
      {Object.entries(fields).map(
        ([fieldKey, fieldValue]) => (
          <StyleFieldRow
            key={fieldKey}
            rules={rules}
            ruleIndex={ruleIndex}
            fieldKey={fieldKey}
            fieldValue={fieldValue}
            isReadOnly={isReadOnly}
            onCommitRules={onCommitRules}
          />
        ),
      )}
      {Object.keys(fields).length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No fields yet.
        </p>
      )}
      <div className="mt-2">
        <label
          htmlFor={`ssf-regex-${ruleIndex}`}
          className="block text-xs text-slate-400 mb-0.5"
        >
          Ignore Style Names
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 font-mono shrink-0">
            /
          </span>
          <input
            id={`ssf-regex-${ruleIndex}`}
            type="text"
            value={draftRegex}
            placeholder="signs?|op|ed"
            readOnly={isReadOnly}
            onChange={(event) => {
              setDraftRegex(event.target.value)
            }}
            onBlur={() => {
              onCommitRules(
                setIgnoredStyleNamesRegex({
                  rules,
                  ruleIndex,
                  value: draftRegex,
                }),
              )
            }}
            className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
          <span className="text-xs text-slate-500 font-mono shrink-0">
            /i
          </span>
        </div>
      </div>
      <ApplyIfBuilder
        rules={rules}
        ruleIndex={ruleIndex}
        applyIfValue={rule.applyIf}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
      <WhenBuilder
        rules={rules}
        ruleIndex={ruleIndex}
        whenValue={rule.when}
        predicates={predicates}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
    </div>
  )
}
