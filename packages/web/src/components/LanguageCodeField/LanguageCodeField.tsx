import { useRef, useState } from "react"
import type { CommandField } from "../../commands/types"
import { ISO_639_2_NAME_BY_CODE } from "../../data/iso639-2"
import { buildOrderedLanguageOptions } from "../../data/orderLanguageOptions"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { LanguageDropdown } from "../LanguageDropdown/LanguageDropdown"
import { TagInputBase } from "../TagInputBase/TagInputBase"

type LanguageCodeFieldProps = {
  step: Step
  field: CommandField
}

export const LanguageCodeField = ({
  step,
  field,
}: LanguageCodeFieldProps) => {
  const { setParam } = useBuilderActions()
  const [filterText, setFilterText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rawValue = step.params[field.name]
  const selected =
    typeof rawValue === "string" && rawValue.length > 0
      ? rawValue
      : null

  const clearSelection = () => {
    setParam(step.id, field.name, undefined)
  }

  const selectCode = (code: string) => {
    setParam(step.id, field.name, code)
    setFilterText("")
    setIsOpen(false)
  }

  const visibleOptions = buildOrderedLanguageOptions({
    filterText,
    excluded: selected ? [selected] : [],
  })

  const tags = selected
    ? [
        {
          key: selected,
          label: (
            <>
              <span>
                {ISO_639_2_NAME_BY_CODE[selected] ??
                  selected}
              </span>
              <span className="font-mono text-slate-400 ml-1">
                {selected}
              </span>
            </>
          ),
          title: `Remove ${selected}`,
        },
      ]
    : []

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <TagInputBase
        tags={tags}
        onRemove={clearSelection}
        inputRef={inputRef}
        inputProps={{
          role: "combobox",
          "aria-expanded": isOpen,
          "aria-haspopup": "listbox",
          "aria-required": field.isRequired
            ? "true"
            : undefined,
          value: filterText,
          placeholder: selected
            ? "Type to replace language…"
            : "Type to filter languages…",
          onChange: (event) => {
            setFilterText(event.target.value)
            setIsOpen(true)
          },
          onFocus: () => setIsOpen(true),
          onBlur: () =>
            setTimeout(() => setIsOpen(false), 150),
        }}
      />
      <LanguageDropdown
        anchorRef={inputRef}
        isOpen={isOpen}
        options={visibleOptions}
        onSelect={selectCode}
      />
    </div>
  )
}
