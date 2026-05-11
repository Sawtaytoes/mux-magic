import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { CommandField, Step } from "../../types"

type StringArrayFieldProps = {
  field: CommandField
  step: Step
}

export const StringArrayField = ({
  field,
  step,
}: StringArrayFieldProps) => {
  const { setParam } = useBuilderActions()

  const value = step.params[field.name] as
    | string[]
    | undefined
  const displayValue = Array.isArray(value)
    ? value.join(", ")
    : ""

  const handleChange = (text: string) => {
    const array = text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    setParam(step.id, field.name, array)
  }

  return (
    <input
      type="text"
      value={displayValue}
      placeholder={field.placeholder ?? ""}
      onChange={(event) => handleChange(event.target.value)}
      className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
    />
  )
}
