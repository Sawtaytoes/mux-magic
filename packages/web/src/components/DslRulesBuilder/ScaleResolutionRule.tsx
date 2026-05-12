import { useState } from "react"

import {
  setScaleResolutionDimension,
  setScaleResolutionFlag,
} from "./ruleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  ScaleResolutionRule as ScaleResolutionRuleType,
} from "./types"
import { WhenBuilder } from "./WhenBuilder"

type ScaleResolutionRuleProps = {
  rules: DslRule[]
  ruleIndex: number
  rule: ScaleResolutionRuleType
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

const DimensionInput = ({
  id,
  label,
  ariaLabel,
  value,
  readOnly,
  onCommit,
}: {
  id: string
  label: string
  ariaLabel?: string
  value: number
  readOnly: boolean
  onCommit: (nextValue: number) => void
}) => {
  const [draft, setDraft] = useState(String(value))

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={id}
        className="text-xs text-slate-400 w-12 shrink-0"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={draft}
        readOnly={readOnly}
        aria-label={ariaLabel}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onFocus={(event) => {
          event.target.select()
        }}
        onBlur={() => {
          const parsed = draft === "" ? 0 : Number(draft)
          onCommit(parsed)
        }}
        className="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}

export const ScaleResolutionRuleBody = ({
  rules,
  ruleIndex,
  rule,
  predicates,
  isReadOnly,
  stepId,
  openDetailsKeys,
  onToggleDetails,
  onCommitRules,
}: ScaleResolutionRuleProps) => (
  <div className="mt-2">
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      <div>
        <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
          from
        </span>
        <DimensionInput
          id={`srr-from-width-${ruleIndex}`}
          label="width"
          ariaLabel="From width"
          value={rule.from?.width ?? 0}
          readOnly={isReadOnly}
          onCommit={(val) => {
            onCommitRules(
              setScaleResolutionDimension({
                rules,
                ruleIndex,
                group: "from",
                dimension: "width",
                value: val,
              }),
            )
          }}
        />
        <div className="mt-1">
          <DimensionInput
            id={`srr-from-height-${ruleIndex}`}
            label="height"
            value={rule.from?.height ?? 0}
            readOnly={isReadOnly}
            onCommit={(val) => {
              onCommitRules(
                setScaleResolutionDimension({
                  rules,
                  ruleIndex,
                  group: "from",
                  dimension: "height",
                  value: val,
                }),
              )
            }}
          />
        </div>
      </div>
      <div>
        <span className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
          to
        </span>
        <DimensionInput
          id={`srr-to-width-${ruleIndex}`}
          label="width"
          value={rule.to?.width ?? 0}
          readOnly={isReadOnly}
          onCommit={(val) => {
            onCommitRules(
              setScaleResolutionDimension({
                rules,
                ruleIndex,
                group: "to",
                dimension: "width",
                value: val,
              }),
            )
          }}
        />
        <div className="mt-1">
          <DimensionInput
            id={`srr-to-height-${ruleIndex}`}
            label="height"
            value={rule.to?.height ?? 0}
            readOnly={isReadOnly}
            onCommit={(val) => {
              onCommitRules(
                setScaleResolutionDimension({
                  rules,
                  ruleIndex,
                  group: "to",
                  dimension: "height",
                  value: val,
                }),
              )
            }}
          />
        </div>
      </div>
    </div>
    <label className="flex items-center gap-2 mt-2 cursor-pointer">
      <input
        type="checkbox"
        checked={rule.hasScaledBorderAndShadow ?? false}
        disabled={isReadOnly}
        onChange={(event) => {
          onCommitRules(
            setScaleResolutionFlag({
              rules,
              ruleIndex,
              flagName: "hasScaledBorderAndShadow",
              value: event.target.checked,
            }),
          )
        }}
        className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
      />
      <span className="text-xs text-slate-400">
        Scale border and shadow
      </span>
    </label>
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
