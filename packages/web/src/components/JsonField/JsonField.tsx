import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type JsonFieldProps = {
  field: CommandField
  step: Step
}

export const JsonField = ({
  field,
  step,
}: JsonFieldProps) => {
  const { setParam } = useBuilderActions()

  const value = step.params[field.name]
  const link = step.links?.[field.name]
  const isLinked =
    link && typeof link === "object" && link.linkedTo

  let displayValue = ""
  if (value !== undefined) {
    if (typeof value === "string") {
      displayValue = value
    } else {
      displayValue = JSON.stringify(value, null, 2)
    }
  }

  const handleChange = (text: string) => {
    try {
      const parsed = JSON.parse(text)
      setParam(step.id, field.name, parsed)
    } catch {
      setParam(step.id, field.name, text)
    }
  }

  if (isLinked) {
    return (
      <div className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 border border-slate-700 italic font-mono">
        Linked → {link.linkedTo}.{link.output ?? "folder"}
      </div>
    )
  }

  return (
    <textarea
      id={`${step.command}-${field.name}`}
      value={displayValue}
      placeholder={field.placeholder ?? "[]"}
      onChange={(event) => handleChange(event.target.value)}
      rows={3}
      aria-required={field.isRequired ? "true" : undefined}
      className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y"
    />
  )
}
