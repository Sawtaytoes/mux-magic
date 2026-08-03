import type { ListboxItem } from "@charcuterie/ui"
import { Combobox } from "@charcuterie/ui"
import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"
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
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

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

  // The parent owns the multi-selection and excludes already-picked
  // extensions from the option list, so the Combobox is a single-select
  // "add one" picker rather than `isMultiple`: on pick it commits and
  // closes. Two codecs share the `sup` extension, so the option identity
  // is the (unique) codec and the pick resolves back to its extension.
  const addValue = (codec: string) => {
    const option = SUBTITLE_TYPE_OPTIONS.find(
      (candidate) => candidate.codec === codec,
    )
    if (!option || selected.includes(option.value)) {
      return
    }
    setParam(
      step.id,
      field.name,
      selected.concat(option.value),
    )
    setQuery("")
    setIsOpen(false)
  }

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  // The consumer owns the query — options arrive pre-filtered by the same
  // value/codec/description match the field has always used, minus the
  // extensions already selected.
  const normalizedFilter = query.trim().toLowerCase()
  const options: ListboxItem[] =
    SUBTITLE_TYPE_OPTIONS.filter(
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
    ).map((option) => ({
      value: option.codec,
      textValue: `${option.value} ${option.codec} ${option.description}`,
      label: (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span className="text-xs">
            {option.value}
            <span className="text-slate-400 ml-1">
              — {option.description}
            </span>
          </span>
          <span className="font-mono text-slate-400 text-xs">
            {option.codec}
          </span>
        </span>
      ),
    }))

  const trigger = (
    <button
      type="button"
      aria-label={`Add ${field.label ?? field.name}`}
      onClick={() =>
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }
      className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer"
    >
      <span className="flex-1 min-w-0 truncate text-slate-400">
        Type to filter subtitle types…
      </span>
      <span className="text-slate-400 shrink-0">▾</span>
    </button>
  )

  return (
    <CommandFieldGroup field={field}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5"
            >
              <span className="font-mono">{value}</span>
              <button
                type="button"
                onClick={() => removeValue(value)}
                className="text-slate-400 hover:text-red-400 leading-none cursor-pointer"
                title={`Remove ${value}`}
                aria-label={`Remove ${value}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <Combobox
        trigger={trigger}
        isVisible={isOpen}
        onDismiss={close}
        onSelect={addValue}
        options={options}
        query={query}
        onQueryChange={setQuery}
        placeholder="Type to filter subtitle types…"
        emptyLabel="No matches."
      />
    </CommandFieldGroup>
  )
}
