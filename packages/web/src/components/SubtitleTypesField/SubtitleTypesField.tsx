import { useRef, useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { PortalDropdown } from "../PortalDropdown/PortalDropdown"
import { TagInputBase } from "../TagInputBase/TagInputBase"
import { SUBTITLE_TYPE_OPTIONS } from "./SubtitleTypesField.options"

type SubtitleTypesFieldProps = {
  step: Step
  field: CommandField
}

export const SubtitleTypesField = ({
  step,
  field,
}: SubtitleTypesFieldProps) => {
  const { setParam } = useBuilderActions()
  const [filterText, setFilterText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = Array.isArray(step.params[field.name])
    ? (step.params[field.name] as string[])
    : []

  const removeValue = (valueToRemove: string) => {
    const updated = selected.filter(
      (value) => value !== valueToRemove,
    )
    setParam(
      step.id,
      field.name,
      updated.length > 0 ? updated : undefined,
    )
  }

  const addValue = (value: string) => {
    if (selected.includes(value)) {
      return
    }
    setParam(step.id, field.name, selected.concat(value))
    setFilterText("")
    setIsOpen(false)
  }

  const normalizedFilter = filterText.trim().toLowerCase()
  const visibleOptions = SUBTITLE_TYPE_OPTIONS.filter(
    (option) =>
      !selected.includes(option.value) &&
      (normalizedFilter === "" ||
        option.value
          .toLowerCase()
          .includes(normalizedFilter) ||
        option.codec
          .toLowerCase()
          .includes(normalizedFilter) ||
        option.description
          .toLowerCase()
          .includes(normalizedFilter)),
  )

  const tags = selected.map((value) => ({
    key: value,
    label: <span className="font-mono">{value}</span>,
    title: `Remove ${value}`,
  }))

  const items = visibleOptions.map((option) => ({
    key: `${option.value}-${option.codec}`,
    onSelect: () => addValue(option.value),
    content: (
      <>
        <span className="text-xs">
          {option.value}
          <span className="text-slate-400 ml-1">
            — {option.description}
          </span>
        </span>
        <span className="font-mono text-slate-400 text-xs">
          {option.codec}
        </span>
      </>
    ),
  }))

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <TagInputBase
        tags={tags}
        onRemove={removeValue}
        inputRef={inputRef}
        inputProps={{
          role: "combobox",
          "aria-expanded": isOpen,
          "aria-haspopup": "listbox",
          value: filterText,
          placeholder: "Type to filter subtitle types…",
          onChange: (event) => {
            setFilterText(event.target.value)
            setIsOpen(true)
          },
          onFocus: () => setIsOpen(true),
          onBlur: () =>
            setTimeout(() => setIsOpen(false), 150),
        }}
      />
      <PortalDropdown
        anchorRef={inputRef}
        isOpen={isOpen}
        items={items}
      />
    </div>
  )
}
