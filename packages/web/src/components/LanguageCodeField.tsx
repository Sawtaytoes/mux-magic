import type { CommandField, Step } from "../types"
import { FieldLabel } from "./FieldLabel"

type LanguageCodeFieldProps = {
  step: Step
  field: CommandField
}

export const LanguageCodeField = ({
  step,
  field,
}: LanguageCodeFieldProps) => {
  const value = String(step.params[field.name] ?? "")

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const newValue = (event.target as HTMLInputElement)
      .value
    window.setParam?.(
      step.id,
      field.name,
      newValue || undefined,
    )
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <input
        id={`${step.command}-${field.name}`}
        type="text"
        defaultValue={value}
        placeholder="eng"
        maxLength={3}
        onInput={handleInput}
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}
