import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type NumberFieldProps = {
  field: CommandField
  step: Step
}

export const NumberField = ({
  field,
  step,
}: NumberFieldProps) => {
  const { setParam } = useBuilderActions()
  const value =
    step.params[field.name] ?? field.default ?? ""
  const companion = field.companionNameField
    ? step.params[field.companionNameField]
    : null

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const raw = (event.target as HTMLInputElement).value
    const parsed = raw === "" ? undefined : Number(raw)
    setParam(step.id, field.name, parsed)
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <input
        id={`${step.command}-${field.name}`}
        type="number"
        defaultValue={value as number | string}
        aria-label={field.label ?? field.name}
        placeholder={field.placeholder ?? ""}
        onInput={handleInput}
        aria-required={
          field.isRequired ? "true" : undefined
        }
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
      {field.companionNameField && !!companion && (
        <p
          data-step={step.id}
          data-companion={field.name}
          className="text-xs text-slate-500 mt-0.5 truncate"
          title={String(companion)}
        >
          {String(companion)}
        </p>
      )}
    </div>
  )
}
