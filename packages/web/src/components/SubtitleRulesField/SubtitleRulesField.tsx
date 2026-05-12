import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import type { Step } from "../../types"
import { DslRulesBuilder } from "../DslRulesBuilder/DslRulesBuilder"
import { RuleCard } from "../DslRulesBuilder/RuleCard"
import type { DslRule } from "../DslRulesBuilder/types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

const DEFAULT_RULES_PREVIEW: DslRule[] = [
  {
    type: "setScriptInfo",
    key: "ScriptType",
    value: "v4.00+",
  },
  {
    type: "setScriptInfo",
    key: "YCbCr Matrix",
    value: "TV.709",
  },
  {
    type: "setStyleFields",
    fields: {
      MarginV: "90",
      MarginL: "210",
      MarginR: "210",
    },
    ignoredStyleNamesRegexString:
      "signs?|op|ed|opening|ending",
  },
]

const DEFAULT_RULES_PREVIEW_KEYS: string[] =
  DEFAULT_RULES_PREVIEW.map((rule, ruleIndex) => {
    if (rule.type === "setScriptInfo") {
      return `setScriptInfo-${rule.key}`
    }
    if (rule.type === "setStyleFields") {
      return `setStyleFields-${Object.keys(rule.fields).join("-")}`
    }
    return `${rule.type}-${ruleIndex}`
  })

type SubtitleRulesFieldProps = {
  field: CommandField
  step: Step
}

// `hasDefaultRules` is declared as a `hidden` type in commands.ts so the
// dispatcher skips it — it's owned by this component and rendered inline
// next to the field label so the user can toggle prepended-defaults
// without a separate row.
export const SubtitleRulesField = ({
  field,
  step,
}: SubtitleRulesFieldProps) => {
  const { setParam } = useBuilderActions()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const hasDefaultRules = Boolean(
    step.params.hasDefaultRules ?? false,
  )

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <FieldLabel command={step.command} field={field} />
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-slate-300">
          <input
            id={`${step.command}-hasDefaultRules`}
            type="checkbox"
            checked={hasDefaultRules}
            onChange={(event) => {
              setParam(
                step.id,
                "hasDefaultRules",
                event.target.checked,
              )
            }}
            className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
          />
          Has Default Rules
        </label>
      </div>
      {hasDefaultRules && (
        <div className="mt-2 mb-3 border border-amber-800/50 rounded px-3 py-2 bg-amber-950/20">
          <button
            type="button"
            onClick={() => {
              setIsPreviewOpen((prev) => !prev)
            }}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 w-full text-left mb-1"
          >
            <CollapseChevron isCollapsed={!isPreviewOpen} />
            {
              "Default rules (applied before user rules; read-only):"
            }
          </button>
          {isPreviewOpen && (
            <div className="space-y-2">
              {DEFAULT_RULES_PREVIEW.map(
                (rule, ruleIndex) => (
                  <RuleCard
                    key={
                      DEFAULT_RULES_PREVIEW_KEYS[ruleIndex]
                    }
                    rules={DEFAULT_RULES_PREVIEW}
                    ruleIndex={ruleIndex}
                    rule={rule}
                    predicates={{}}
                    isReadOnly={true}
                    isFirst={ruleIndex === 0}
                    isLast={
                      ruleIndex ===
                      DEFAULT_RULES_PREVIEW.length - 1
                    }
                    stepId={step.id}
                    openDetailsKeys={new Set()}
                    onToggleDetails={() => {}}
                    onCommitRules={() => {}}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
      <DslRulesBuilder step={step} />
    </div>
  )
}
