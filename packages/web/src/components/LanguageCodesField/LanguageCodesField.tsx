import { useRef, useState } from "react"
import type { CommandField } from "../../commands/types"
import { ISO_639_2_NAME_BY_CODE } from "../../data/iso639-2"
import { buildOrderedLanguageOptions } from "../../data/orderLanguageOptions"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { PortalDropdown } from "../PortalDropdown/PortalDropdown"
import { TagInputBase } from "../TagInputBase/TagInputBase"

type LanguageCodesFieldProps = {
  step: Step
  field: CommandField
}

export const LanguageCodesField = ({
  step,
  field,
}: LanguageCodesFieldProps) => {
  const { setParam } = useBuilderActions()
  const [filterText, setFilterText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = Array.isArray(step.params[field.name])
    ? (step.params[field.name] as string[])
    : []

  const removeCode = (codeToRemove: string) => {
    const updated = selected.filter(
      (code) => code !== codeToRemove,
    )
    setParam(
      step.id,
      field.name,
      updated.length > 0 ? updated : undefined,
    )
  }

  const addCode = (code: string) => {
    if (selected.includes(code)) return
    setParam(step.id, field.name, [...selected, code])
    setFilterText("")
    setIsOpen(false)
  }

  const visibleOptions = buildOrderedLanguageOptions({
    filterText,
    excluded: selected,
  })

  const tags = selected.map((code) => ({
    key: code,
    label: (
      <>
        <span>{ISO_639_2_NAME_BY_CODE[code] ?? code}</span>
        <span className="font-mono text-slate-400 ml-1">
          {code}
        </span>
      </>
    ),
    title: `Remove ${code}`,
  }))

  const items = visibleOptions.map(({ code, name }) => ({
    key: code,
    onSelect: () => addCode(code),
    content: (
      <>
        <span className="text-xs">{name}</span>
        <span className="font-mono text-slate-400 text-xs">
          {code}
        </span>
      </>
    ),
  }))

  return (
    <div>
      <FieldLabel stepId={step.id} field={field} />
      <TagInputBase
        tags={tags}
        onRemove={removeCode}
        inputRef={inputRef}
        inputProps={{
          role: "combobox",
          "aria-expanded": isOpen,
          "aria-haspopup": "listbox",
          value: filterText,
          placeholder: "Type to filter languages…",
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
