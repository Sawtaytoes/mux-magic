import type { ListboxItem } from "@charcuterie/ui"
import { Combobox, IconButton } from "@charcuterie/ui"
import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { ISO_639_2_NAME_BY_CODE } from "../../data/iso639-2"
import { buildOrderedLanguageOptions } from "../../data/orderLanguageOptions"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"

type LanguageSelection = {
  code: string
  ietf?: string
}

const normalizeRawItem = (
  rawItem: unknown,
): LanguageSelection | null => {
  if (typeof rawItem === "string" && rawItem.length > 0) {
    return { code: rawItem }
  }
  if (
    rawItem !== null &&
    typeof rawItem === "object" &&
    "code" in rawItem &&
    typeof (rawItem as LanguageSelection).code === "string"
  ) {
    return rawItem as LanguageSelection
  }
  return null
}

const normalizeSelections = (
  raw: unknown,
): LanguageSelection[] => {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.reduce<LanguageSelection[]>(
    (accumulated, rawItem) => {
      const normalized = normalizeRawItem(rawItem)
      return normalized
        ? accumulated.concat(normalized)
        : accumulated
    },
    [],
  )
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
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const selected = normalizeSelections(
    step.params[field.name],
  )

  const selectedCodes = selected.map(
    (selection) => selection.code,
  )

  const removeCode = (codeToRemove: string) => {
    const updated = selected.filter(
      (selection) => selection.code !== codeToRemove,
    )
    setParam(
      step.id,
      field.name,
      updated.length > 0 ? updated : undefined,
    )
  }

  // The parent owns the multi-selection and excludes already-picked
  // codes from the option list, so the Combobox is a single-select "add
  // one" picker rather than `isMultiple`: on pick it commits and closes.
  const addCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      return
    }
    setParam(step.id, field.name, [...selected, { code }])
    setQuery("")
    setIsOpen(false)
  }

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  // The consumer owns the query (eng-pinned ordering + the 50-option cap
  // live in buildOrderedLanguageOptions), so options arrive pre-filtered.
  const options: ListboxItem[] =
    buildOrderedLanguageOptions({
      filterText: query,
      excluded: selectedCodes,
    }).map(({ code, name }) => ({
      value: code,
      textValue: `${name} ${code}`,
      label: (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span className="text-xs">{name}</span>
          <span className="font-mono text-content-muted text-xs">
            {code}
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
      className="w-full bg-surface-sunken hover:bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus text-left flex items-center gap-2 cursor-pointer"
    >
      <span className="flex-1 min-w-0 truncate text-content-muted">
        Type to filter languages…
      </span>
      <span className="text-content-secondary shrink-0">▾</span>
    </button>
  )

  return (
    <CommandFieldGroup field={field}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map((selection) => (
            <span
              key={selection.code}
              className="inline-flex items-center gap-1 bg-surface-sunken text-content-primary text-xs rounded px-1.5 py-0.5"
            >
              <span>
                {ISO_639_2_NAME_BY_CODE[selection.code] ??
                  selection.code}
              </span>
              <span className="font-mono text-content-muted ml-1">
                {selection.ietf
                  ? `${selection.code} · ${selection.ietf}`
                  : selection.code}
              </span>
              <IconButton
                label={`Remove ${selection.code}`}
                title={`Remove ${selection.code}`}
                intent="danger"
                appearance="ghost"
                size="sm"
                onClick={() => removeCode(selection.code)}
                className="leading-none"
              >
                ✕
              </IconButton>
            </span>
          ))}
        </div>
      )}

      <Combobox
        trigger={trigger}
        isVisible={isOpen}
        onDismiss={close}
        onSelect={addCode}
        options={options}
        query={query}
        onQueryChange={setQuery}
        placeholder="Type to filter languages…"
        emptyLabel="No matches."
      />
    </CommandFieldGroup>
  )
}
