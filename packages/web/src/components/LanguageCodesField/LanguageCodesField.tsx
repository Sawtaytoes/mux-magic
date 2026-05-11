import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { CommandField, Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type LanguageCodesFieldProps = {
  step: Step
  field: CommandField
}

export const LanguageCodesField = ({
  step,
  field,
}: LanguageCodesFieldProps) => {
  const { setParam } = useBuilderActions()
  const val = step.params[field.name]
  const displayValue = Array.isArray(val)
    ? val.join(", ")
    : typeof val === "string"
      ? val
      : ""

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const inputValue = (event.target as HTMLInputElement)
      .value
    const codes = inputValue
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code.length > 0)
    setParam(
      step.id,
      field.name,
      codes.length > 0 ? codes : undefined,
    )
  }

  const placeholder = field.placeholder ?? "eng, jpn"

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <input
        id={`${step.command}-${field.name}`}
        type="text"
        defaultValue={displayValue}
        placeholder={placeholder}
        onInput={handleInput}
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}
