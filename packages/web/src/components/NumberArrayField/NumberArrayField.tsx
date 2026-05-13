import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type NumberArrayFieldProps = {
  field: CommandField
  step: Step
}

export const NumberArrayField = ({
  field,
  step,
}: NumberArrayFieldProps) => {
  const { setParam } = useBuilderActions()

  const value = step.params[field.name] as
    | number[]
    | undefined
  const displayValue = Array.isArray(value)
    ? value.join(", ")
    : ""

  const handleChange = (text: string) => {
    const array = text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map(Number)
      .filter((num) => !Number.isNaN(num))

    setParam(step.id, field.name, array)
  }

  return (
    <input
      id={`${step.command}-${field.name}`}
      type="text"
      value={displayValue}
      placeholder={field.placeholder ?? "0, 100"}
      onChange={(event) => handleChange(event.target.value)}
      aria-required={field.isRequired ? "true" : undefined}
      className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
    />
  )
}
