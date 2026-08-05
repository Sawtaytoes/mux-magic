import type { ListboxItem } from "@charcuterie/ui"
import { Combobox } from "@charcuterie/ui"
import { useState } from "react"

type AssFieldPickerProps = {
  label: string
  value: string
  options: readonly string[]
  isReadOnly: boolean
  inputId: string
  onChange: (newValue: string) => void
}

// A searchable field-name picker that also lets the user commit a custom
// value: the ASS spec keeps evolving and a rule can legitimately target a
// field not in our curated list. That is `isCreatable` — Enter on a query
// with no matching option commits it raw.
export const AssFieldPicker = ({
  label,
  value,
  options,
  isReadOnly,
  inputId,
  onChange,
}: AssFieldPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const items: ListboxItem[] = options.map((option) => ({
    value: option,
    label: option,
  }))

  const trigger = (
    <button
      id={inputId}
      type="button"
      aria-label={label}
      disabled={isReadOnly}
      onClick={() => {
        if (isReadOnly) return
        setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)
      }}
      className="w-32 bg-surface-sunken hover:bg-surface-raised text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono text-left flex items-center gap-1 cursor-pointer disabled:cursor-default disabled:opacity-60"
    >
      <span className="flex-1 min-w-0 truncate">
        {value || (
          <span className="text-content-muted">Field</span>
        )}
      </span>
      {!isReadOnly && (
        <span className="text-content-secondary shrink-0">▾</span>
      )}
    </button>
  )

  return (
    <Combobox
      trigger={trigger}
      isVisible={isOpen}
      onDismiss={() => setIsOpen(false)}
      onSelect={onChange}
      options={items}
      selectedValue={value}
      isCreatable
      placeholder="Search or type custom…"
      emptyLabel="No matches."
    />
  )
}
