import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type StringFieldProps = {
  field: CommandField
  step: Step
}

export const StringField = ({
  field,
  step,
}: StringFieldProps) => {
  const { setParam } = useBuilderActions()
  const value = step.params[field.name] ?? ""

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const newValue = (event.target as HTMLInputElement)
      .value
    setParam(step.id, field.name, newValue || undefined)
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <input
        id={`${step.command}-${field.name}`}
        type="text"
        defaultValue={String(value)}
        placeholder={field.placeholder ?? ""}
        onInput={handleInput}
        aria-required={field.required ? "true" : undefined}
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}
