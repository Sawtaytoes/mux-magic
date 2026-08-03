import type { ListboxItem } from "@charcuterie/ui"
import { Combobox } from "@charcuterie/ui"
import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"

type EnumFieldProps = {
  step: Step
  field: CommandField
}

export const EnumField = ({
  step,
  field,
}: EnumFieldProps) => {
  const { setParam } = useBuilderActions()
  const [isOpen, setIsOpen] = useState(false)

  const enumOptions = field.options ?? []

  const selected =
    step.params[field.name] ?? field.default ?? ""
  const selectedOption = enumOptions.find(
    (option) => option.value === selected,
  )
  const triggerLabel =
    selectedOption?.label ?? String(selected)

  // Enum values may be non-string (number/boolean); the Combobox keys on
  // strings, so map back to the original typed value on select.
  const optionByValue = new Map(
    enumOptions.map((option) => [
      String(option.value),
      option.value,
    ]),
  )

  const options: ListboxItem[] = enumOptions.map(
    (option) => ({
      value: String(option.value),
      textValue: `${option.label} ${String(option.value)}`,
      label: option.label,
    }),
  )

  const handleSelect = (value: string) => {
    setParam(
      step.id,
      field.name,
      optionByValue.get(value) ?? value,
    )
    setIsOpen(false)
  }

  const trigger = (
    <button
      type="button"
      onClick={() =>
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }
      data-enum-picker-trigger
      className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer"
    >
      <span className="flex-1 min-w-0 truncate">
        {triggerLabel}
      </span>
      <span className="text-slate-400 shrink-0">▾</span>
    </button>
  )

  return (
    <CommandFieldGroup field={field}>
      <Combobox
        trigger={trigger}
        isVisible={isOpen}
        onDismiss={() => setIsOpen(false)}
        onSelect={handleSelect}
        options={options}
        selectedValue={String(selected)}
        placeholder="Search options…"
        emptyLabel="No options match."
      />
    </CommandFieldGroup>
  )
}
