import { useState } from "react"

import { setScriptInfoField } from "./ruleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  SetScriptInfoRule as SetScriptInfoRuleType,
} from "./types"
import { WhenBuilder } from "./WhenBuilder"

type SetScriptInfoRuleProps = {
  rules: DslRule[]
  ruleIndex: number
  rule: SetScriptInfoRuleType
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

export const SetScriptInfoRuleBody = ({
  rules,
  ruleIndex,
  rule,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: SetScriptInfoRuleProps) => {
  const [draftKey, setDraftKey] = useState(rule.key)
  const [draftValue, setDraftValue] = useState(rule.value)

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`ssr-key-${ruleIndex}`}
          className="text-xs text-slate-400 w-10 shrink-0"
        >
          key
        </label>
        <input
          id={`ssr-key-${ruleIndex}`}
          type="text"
          value={draftKey}
          placeholder="Title"
          readOnly={isReadOnly}
          onChange={(event) => {
            setDraftKey(event.target.value)
          }}
          onBlur={() => {
            onCommitRules(
              setScriptInfoField({
                rules,
                ruleIndex,
                fieldName: "key",
                value: draftKey,
              }),
            )
          }}
          className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <label
          htmlFor={`ssr-value-${ruleIndex}`}
          className="text-xs text-slate-400 w-10 shrink-0"
        >
          value
        </label>
        <input
          id={`ssr-value-${ruleIndex}`}
          type="text"
          value={draftValue}
          placeholder="My Subtitles"
          readOnly={isReadOnly}
          onChange={(event) => {
            setDraftValue(event.target.value)
          }}
          onBlur={() => {
            onCommitRules(
              setScriptInfoField({
                rules,
                ruleIndex,
                fieldName: "value",
                value: draftValue,
              }),
            )
          }}
          className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>
      <WhenBuilder
        rules={rules}
        ruleIndex={ruleIndex}
        whenValue={rule.when}
        predicates={{}}
        isReadOnly={isReadOnly}
        stepId={stepId}
        openDetailsKeys={openDetailsKeys}
        onToggleDetails={onToggleDetails}
        onCommitRules={onCommitRules}
      />
    </div>
  )
}
