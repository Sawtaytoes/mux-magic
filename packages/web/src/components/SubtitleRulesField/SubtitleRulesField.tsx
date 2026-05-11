import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { CommandField, Step } from "../../types"
import { DslRulesBuilder } from "../DslRulesBuilder/DslRulesBuilder"
import { FieldLabel } from "../FieldLabel/FieldLabel"

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
      <DslRulesBuilder step={step} />
    </div>
  )
}
