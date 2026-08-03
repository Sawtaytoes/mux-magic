import type { ListboxItem } from "@charcuterie/ui"
import { Combobox } from "@charcuterie/ui"
import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { ISO_639_2_NAME_BY_CODE } from "../../data/iso639-2"
import { buildOrderedLanguageOptions } from "../../data/orderLanguageOptions"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"
import { RegionVariantField } from "./RegionVariantField"

type LanguageSelection = {
  code: string
  ietf?: string
}

const normalizeParam = (
  raw: unknown,
): LanguageSelection | null => {
  if (typeof raw === "string" && raw.length > 0) {
    return { code: raw }
  }
  if (
    raw !== null &&
    typeof raw === "object" &&
    "code" in raw &&
    typeof (raw as LanguageSelection).code === "string"
  ) {
    return raw as LanguageSelection
  }
  return null
}

type LanguageCodeFieldProps = {
  step: Step
  field: CommandField
}

export const LanguageCodeField = ({
  step,
  field,
}: LanguageCodeFieldProps) => {
  const { setParam } = useBuilderActions()
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const selected = normalizeParam(step.params[field.name])

  const clearSelection = () => {
    setParam(step.id, field.name, undefined)
  }

  // Single-select: a pick replaces the previous language and closes the
  // picker. The current code is excluded from the list.
  const selectCode = (code: string) => {
    setParam(step.id, field.name, { code })
    setQuery("")
    setIsOpen(false)
  }

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  const handleIetfChange = (tag: string | null) => {
    if (!selected) {
      return
    }
    const updated: LanguageSelection = tag
      ? { code: selected.code, ietf: tag }
      : { code: selected.code }
    setParam(step.id, field.name, updated)
  }

  // The consumer owns the query (eng-pinned ordering + the 50-option cap
  // live in buildOrderedLanguageOptions), so options arrive pre-filtered.
  const options: ListboxItem[] =
    buildOrderedLanguageOptions({
      filterText: query,
      excluded: selected ? [selected.code] : [],
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

  const triggerLabel = selected
    ? `Change ${field.label ?? field.name}`
    : `Add ${field.label ?? field.name}`

  const trigger = (
    <button
      type="button"
      aria-label={triggerLabel}
      onClick={() =>
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }
      className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2 cursor-pointer"
    >
      <span className="flex-1 min-w-0 truncate text-slate-400">
        {selected
          ? "Type to replace language…"
          : "Type to filter languages…"}
      </span>
      <span className="text-slate-400 shrink-0">▾</span>
    </button>
  )

  return (
    <>
      <CommandFieldGroup field={field}>
        {selected && (
          <div className="flex flex-wrap gap-1 mb-1">
            <span className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5">
              <span>
                {ISO_639_2_NAME_BY_CODE[selected.code] ??
                  selected.code}
              </span>
              <span className="font-mono text-slate-400 ml-1">
                {selected.ietf
                  ? `${selected.code} · ${selected.ietf}`
                  : selected.code}
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-slate-400 hover:text-red-400 leading-none cursor-pointer"
                title={`Remove ${selected.code}`}
                aria-label={`Remove ${selected.code}`}
              >
                ✕
              </button>
            </span>
          </div>
        )}

        <Combobox
          trigger={trigger}
          isVisible={isOpen}
          onDismiss={close}
          onSelect={selectCode}
          options={options}
          query={query}
          onQueryChange={setQuery}
          placeholder={
            selected
              ? "Type to replace language…"
              : "Type to filter languages…"
          }
          emptyLabel="No matches."
        />
      </CommandFieldGroup>

      <RegionVariantField
        baseCode={selected?.code ?? ""}
        selectedIetf={selected?.ietf ?? null}
        onIetfChange={handleIetfChange}
      />
    </>
  )
}
