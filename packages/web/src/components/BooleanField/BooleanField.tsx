import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { CommandField, Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type BooleanFieldProps = {
  field: CommandField
  step: Step
}

export const BooleanField = ({
  field,
  step,
}: BooleanFieldProps) => {
  const { setParam } = useBuilderActions()
  const checked =
    step.params[field.name] ?? field.default ?? false

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setParam(step.id, field.name, event.target.checked)
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none py-0.5">
      <input
        id={`${step.command}-${field.name}`}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={handleChange}
        aria-label={field.label ?? field.name}
        className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
      />
      <FieldLabel command={step.command} field={field} />
    </label>
  )
}
