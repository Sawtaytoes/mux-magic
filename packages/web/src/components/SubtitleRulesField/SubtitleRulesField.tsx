import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { CollapseChevron } from "../../icons/CollapseChevron/CollapseChevron"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"
import { DslRulesBuilder } from "../DslRulesBuilder/DslRulesBuilder"
import { RuleCard } from "../DslRulesBuilder/RuleCard"
import type { DslRule } from "../DslRulesBuilder/types"

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
    <CommandFieldGroup
      actions={
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-content-secondary">
          <input
            type="checkbox"
            checked={hasDefaultRules}
            onChange={(event) => {
              setParam(
                step.id,
                "hasDefaultRules",
                event.target.checked,
              )
            }}
            className="w-3.5 h-3.5 rounded bg-surface-sunken border-border-strong accent-intent-accent-solid cursor-pointer"
          />
          Has Default Rules
        </label>
      }
      className="mb-2"
      field={field}
    >
      {hasDefaultRules && (
        <div className="mt-2 mb-3 border border-intent-warning-border rounded px-3 py-2 bg-intent-warning-surface">
          <button
            type="button"
            onClick={() => {
              setIsPreviewOpen((isPrev) => !isPrev)
            }}
            className="flex items-center gap-1 text-xs text-intent-warning-content w-full text-left mb-1"
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
                    ruleKey={
                      DEFAULT_RULES_PREVIEW_KEYS[ruleIndex]
                    }
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
    </CommandFieldGroup>
  )
}
