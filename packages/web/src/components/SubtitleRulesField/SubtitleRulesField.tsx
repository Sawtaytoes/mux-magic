import { useState } from "react"

import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { CommandField, Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type SubtitleRulesFieldProps = {
  field: CommandField
  step: Step
}

export const SubtitleRulesField = ({
  field,
  step,
}: SubtitleRulesFieldProps) => {
  const { setParam } = useBuilderActions()
  const rulesValue = step.params[field.name]
  const rulesJson = JSON.stringify(
    rulesValue ?? [],
    null,
    2,
  )
  const [draft, setDraft] = useState(rulesJson)
  const [parseError, setParseError] = useState<
    string | null
  >(null)

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(draft)
      setParseError(null)
      setParam(step.id, field.name, parsed)
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "Invalid JSON",
      )
    }
  }

  return (
    <div className="mb-2">
      <FieldLabel command={step.command} field={field} />
      <div className="text-xs text-amber-600 bg-amber-950 rounded px-2 py-1.5 border border-amber-700 mb-1.5 italic">
        ⚠️ Visual rules editor coming in Phase 2.5 — edit
        JSON directly for now.
      </div>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setParseError(null)
        }}
        onBlur={handleBlur}
        className="w-full h-48 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        placeholder="Enter rules as JSON..."
      />
      {parseError && (
        <div className="text-xs text-red-400 mt-1">
          Parse error: {parseError}
        </div>
      )}
    </div>
  )
}
