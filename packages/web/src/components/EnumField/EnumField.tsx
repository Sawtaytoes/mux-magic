import { useSetAtom } from "jotai"
import { useRef } from "react"
import type { CommandField } from "../../commands/types"
import { enumPickerStateAtom } from "../../state/pickerAtoms"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type EnumFieldProps = {
  step: Step
  field: CommandField
}

export const EnumField = ({
  step,
  field,
}: EnumFieldProps) => {
  const setEnumPickerState = useSetAtom(enumPickerStateAtom)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selected =
    step.params[field.name] ?? field.default ?? ""
  const selectedOption = (field.options ?? []).find(
    (option) => option.value === selected,
  )
  const triggerLabel =
    selectedOption?.label ?? String(selected)

  const handleClick = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setEnumPickerState({
      anchor: {
        stepId: step.id,
        fieldName: field.name,
      },
      triggerRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <button
        ref={buttonRef}
        id={`${step.command}-${field.name}`}
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
