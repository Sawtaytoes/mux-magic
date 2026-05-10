import type { CommandField, Step } from "../types"
import { FieldLabel } from "./FieldLabel"

type NumberFieldProps = {
  step: Step
  field: CommandField
}

export const NumberField = ({
  step,
  field,
}: NumberFieldProps) => {
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
    window.setParam?.(step.id, field.name, parsed)
    if (field.companionNameField) {
      window.scheduleReverseLookup?.(
        step.id,
        field.name,
        raw,
      )
    }
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <input
        type="number"
        defaultValue={value as number | string}
        aria-label={field.label ?? field.name}
        placeholder={field.placeholder ?? ""}
        onInput={handleInput}
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
      {field.companionNameField && companion && (
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
