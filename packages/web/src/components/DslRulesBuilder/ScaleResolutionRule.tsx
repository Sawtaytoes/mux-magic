import { AspectLockButton } from "./AspectLockButton"
import { DimensionInput } from "./DimensionInput"
import {
  setScaleResolutionAspectLock,
  setScaleResolutionDimension,
  setScaleResolutionDimensionPaired,
  setScaleResolutionFlag,
} from "./ruleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  ScaleResolutionGroup,
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

// Default-on lock: undefined flag ≡ locked.
const isGroupLocked = (
  rule: ScaleResolutionRuleType,
  group: ScaleResolutionGroup,
): boolean =>
  group === "from"
    ? rule.isFromAspectLocked !== false
    : rule.isToAspectLocked !== false

const commitDimensionFor = ({
  rules,
  ruleIndex,
  rule,
  group,
  dimension,
  value,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  rule: ScaleResolutionRuleType
  group: ScaleResolutionGroup
  dimension: "width" | "height"
  value: number
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const mutate = isGroupLocked(rule, group)
    ? setScaleResolutionDimensionPaired
    : setScaleResolutionDimension
  onCommitRules(
    mutate({ rules, ruleIndex, group, dimension, value }),
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
}: ScaleResolutionRuleProps) => {
  const isFromLocked = isGroupLocked(rule, "from")
  const isToLocked = isGroupLocked(rule, "to")
  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              from
            </span>
            <AspectLockButton
              isLocked={isFromLocked}
              isReadOnly={isReadOnly}
              ariaLabel="From aspect ratio lock"
              onToggle={(isNextLocked) => {
                onCommitRules(
                  setScaleResolutionAspectLock({
                    rules,
                    ruleIndex,
                    group: "from",
                    isLocked: isNextLocked,
                  }),
                )
              }}
            />
          </div>
          <DimensionInput
            id={`srr-from-width-${ruleIndex}`}
            label="width"
            ariaLabel="From width"
            value={rule.from?.width ?? 0}
            isReadOnly={isReadOnly}
            onCommit={(val) => {
              commitDimensionFor({
                rules,
                ruleIndex,
                rule,
                group: "from",
                dimension: "width",
                value: val,
                onCommitRules,
              })
            }}
          />
          <div className="mt-1">
            <DimensionInput
              id={`srr-from-height-${ruleIndex}`}
              label="height"
              value={rule.from?.height ?? 0}
              isReadOnly={isReadOnly}
              onCommit={(val) => {
                commitDimensionFor({
                  rules,
                  ruleIndex,
                  rule,
                  group: "from",
                  dimension: "height",
                  value: val,
                  onCommitRules,
                })
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              to
            </span>
            <AspectLockButton
              isLocked={isToLocked}
              isReadOnly={isReadOnly}
              ariaLabel="To aspect ratio lock"
              onToggle={(isNextLocked) => {
                onCommitRules(
                  setScaleResolutionAspectLock({
                    rules,
                    ruleIndex,
                    group: "to",
                    isLocked: isNextLocked,
                  }),
                )
              }}
            />
          </div>
          <DimensionInput
            id={`srr-to-width-${ruleIndex}`}
            label="width"
            value={rule.to?.width ?? 0}
            isReadOnly={isReadOnly}
            onCommit={(val) => {
              commitDimensionFor({
                rules,
                ruleIndex,
                rule,
                group: "to",
                dimension: "width",
                value: val,
                onCommitRules,
              })
            }}
          />
          <div className="mt-1">
            <DimensionInput
              id={`srr-to-height-${ruleIndex}`}
              label="height"
              value={rule.to?.height ?? 0}
              isReadOnly={isReadOnly}
              onCommit={(val) => {
                commitDimensionFor({
                  rules,
                  ruleIndex,
                  rule,
                  group: "to",
                  dimension: "height",
                  value: val,
                  onCommitRules,
                })
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
                isValue: event.target.checked,
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
}
