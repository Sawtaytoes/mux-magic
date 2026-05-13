import { useState } from "react"
import type { CommandField } from "../../commands/types"
import {
  ISO_639_2_LANGUAGES,
  ISO_639_2_NAME_BY_CODE,
} from "../../data/iso639-2"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { TagInputBase } from "../TagInputBase/TagInputBase"

const ENG_PINNED = "eng"
const MAX_DROPDOWN_OPTIONS = 50

const buildOrderedOptions = (filterText: string) => {
  const lower = filterText.toLowerCase()
  const matches = lower
    ? ISO_639_2_LANGUAGES.filter(
        ({ code, name }) =>
          code.includes(lower) ||
          name.toLowerCase().includes(lower),
      )
    : ISO_639_2_LANGUAGES

  const engEntry = matches.find(
    ({ code }) => code === ENG_PINNED,
  )
  const rest = matches.filter(
    ({ code }) => code !== ENG_PINNED,
  )
  const ordered = engEntry ? [engEntry, ...rest] : rest
  return ordered.slice(0, MAX_DROPDOWN_OPTIONS)
}

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

  const visibleOptions = buildOrderedOptions(
    filterText,
  ).filter(({ code }) => !selected.includes(code))

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

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <TagInputBase
        tags={tags}
        onRemove={removeCode}
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
      >
        {isOpen && visibleOptions.length > 0 && (
          <div
            role="listbox"
            className="absolute z-10 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto"
          >
            {visibleOptions.map(({ code, name }) => (
              <div
                key={code}
                role="option"
                aria-selected={false}
                tabIndex={-1}
                onMouseDown={() => addCode(code)}
                className="flex flex-col px-2 py-1.5 cursor-pointer hover:bg-slate-700 text-slate-200"
              >
                <span className="text-xs">{name}</span>
                <span className="font-mono text-slate-400 text-xs">
                  {code}
                </span>
              </div>
            ))}
          </div>
        )}
      </TagInputBase>
    </div>
  )
}
