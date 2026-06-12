import { useRef, useState } from "react"
import type { CommandField } from "../../commands/types"
import { ISO_639_2_NAME_BY_CODE } from "../../data/iso639-2"
import { buildOrderedLanguageOptions } from "../../data/orderLanguageOptions"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { PortalDropdown } from "../PortalDropdown/PortalDropdown"
import { TagInputBase } from "../TagInputBase/TagInputBase"
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
  const [filterText, setFilterText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = normalizeParam(step.params[field.name])

  const clearSelection = () => {
    setParam(step.id, field.name, undefined)
  }

  const selectCode = (code: string) => {
    setParam(step.id, field.name, { code })
    setFilterText("")
    setIsOpen(false)
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

  const visibleOptions = buildOrderedLanguageOptions({
    filterText,
    excluded: selected ? [selected.code] : [],
  })

  const tags = selected
    ? [
        {
          key: selected.code,
          label: (
            <>
              <span>
                {ISO_639_2_NAME_BY_CODE[selected.code] ??
                  selected.code}
              </span>
              <span className="font-mono text-slate-400 ml-1">
                {selected.ietf
                  ? `${selected.code} · ${selected.ietf}`
                  : selected.code}
              </span>
            </>
          ),
          title: `Remove ${selected.code}`,
        },
      ]
    : []

  return (
    <div>
      <FieldLabel stepId={step.id} field={field} />
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
      <RegionVariantField
        baseCode={selected?.code ?? ""}
        selectedIetf={selected?.ietf ?? null}
        onIetfChange={handleIetfChange}
      />
      <PortalDropdown
        anchorRef={inputRef}
        isOpen={isOpen}
        items={visibleOptions.map(({ code, name }) => ({
          key: code,
          onSelect: () => selectCode(code),
          content: (
            <>
              <span className="text-xs">{name}</span>
              <span className="font-mono text-slate-400 text-xs">
                {code}
              </span>
            </>
          ),
        }))}
      />
    </div>
  )
}
