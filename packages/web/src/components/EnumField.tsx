import type { CommandField, Step } from "../types"
import { FieldLabel } from "./FieldLabel"

type EnumFieldProps = {
  step: Step
  field: CommandField
}

export const EnumField = ({
  step,
  field,
}: EnumFieldProps) => {
  const selected =
    step.params[field.name] ?? field.default ?? ""
  const selectedOption = (field.options ?? []).find(
    (option) => option.value === selected,
  )
  const triggerLabel =
    selectedOption?.label ?? String(selected)

  const handleClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    window.enumPicker?.open(
      { stepId: step.id, fieldName: field.name },
      event.currentTarget,
    )
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <button
        type="button"
        onClick={handleClick}
        data-enum-picker-trigger
        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer"
      >
        <span className="flex-1 min-w-0 truncate">
          {triggerLabel}
        </span>
        <span className="text-slate-400 shrink-0">▾</span>
      </button>
    </div>
  )
}
