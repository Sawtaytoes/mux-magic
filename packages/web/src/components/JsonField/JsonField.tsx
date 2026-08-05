import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type JsonFieldProps = {
  field: CommandField
  step: Step
  isReadOnly?: boolean
}

export const JsonField = ({
  field,
  step,
  isReadOnly = false,
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
      <div className="text-xs text-content-secondary bg-surface-raised rounded px-2 py-1.5 border border-border-default italic font-mono">
        Linked → {link.linkedTo}.{link.output ?? "folder"}
      </div>
    )
  }

  if (isReadOnly) {
    return (
      <textarea
        id={`${step.id}-${field.name}`}
        value={displayValue}
        placeholder={field.placeholder ?? "[]"}
        readOnly
        rows={3}
        aria-required={
          field.isRequired ? "true" : undefined
        }
        className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none font-mono resize-y cursor-default"
      />
    )
  }

  return (
    <textarea
      id={`${step.id}-${field.name}`}
      value={displayValue}
      placeholder={field.placeholder ?? "[]"}
      onChange={(event) => handleChange(event.target.value)}
      rows={3}
      aria-required={field.isRequired ? "true" : undefined}
      className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus font-mono resize-y"
    />
  )
}
