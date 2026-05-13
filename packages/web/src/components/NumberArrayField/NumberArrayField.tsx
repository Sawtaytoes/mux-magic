import { useEffect, useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type NumberArrayFieldProps = {
  field: CommandField
  step: Step
}

const parseNumberArray = (text: string): number[] =>
  text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(Number)
    .filter((num) => !Number.isNaN(num))

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

  const [inputValue, setInputValue] = useState(displayValue)

  useEffect(() => {
    setInputValue(displayValue)
  }, [displayValue])

  const handleBlur = () => {
    setParam(
      step.id,
      field.name,
      parseNumberArray(inputValue),
    )
  }

  return (
    <input
      id={`${step.command}-${field.name}`}
      type="text"
      value={inputValue}
      placeholder={field.placeholder ?? "0, 100"}
      onChange={(event) =>
        setInputValue(event.target.value)
      }
      onBlur={handleBlur}
      aria-required={field.isRequired ? "true" : undefined}
      className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
    />
  )
}
