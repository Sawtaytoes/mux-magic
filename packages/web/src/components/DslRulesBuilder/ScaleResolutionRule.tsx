import { AspectLockButton } from "./AspectLockButton"
import { DimensionInput } from "./DimensionInput"
import {
  readIsAspectLinked,
  setScaleResolutionAspectLink,
  setScaleResolutionDimension,
  setScaleResolutionFlag,
  setScaleResolutionToDimensionLinked,
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
  group: "from" | "to"
  dimension: "width" | "height"
  value: number
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  if (group === "from") {
    // from.* edits are always free — the user is redefining the source aspect
    onCommitRules(
      setScaleResolutionDimension({
        rules,
        ruleIndex,
        group,
        dimension,
        value,
      }),
    )
    return
  }
  // to.* edits: constrained when linked, free when unlinked
  const isLinked = readIsAspectLinked(rule)
  if (isLinked) {
    onCommitRules(
      setScaleResolutionToDimensionLinked({
        rules,
        ruleIndex,
        dimension,
        value,
      }),
    )
  } else {
    onCommitRules(
      setScaleResolutionDimension({
        rules,
        ruleIndex,
        group,
        dimension,
        value,
      }),
    )
  }
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
  const isLinked = readIsAspectLinked(rule)
  return (
    <div className="mt-2">
      <div className="flex items-start gap-2">
        {/* from cluster */}
        <div className="flex-1">
          <div className="mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              from
            </span>
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

        {/* single cross-group link button */}
        <div
          className="flex flex-col items-center justify-center pt-5 gap-1"
          data-testid="aspect-link-divider"
        >
          <AspectLockButton
            isLocked={isLinked}
            isReadOnly={isReadOnly}
            ariaLabel="Aspect ratio link"
            onToggle={(isNextLinked) => {
              onCommitRules(
                setScaleResolutionAspectLink({
                  rules,
                  ruleIndex,
                  isLinked: isNextLinked,
                }),
              )
            }}
          />
        </div>

        {/* to cluster */}
        <div className="flex-1">
          <div className="mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              to
            </span>
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
