import { useState } from "react"

export const DimensionInput = ({
  id,
  label,
  ariaLabel,
  value,
  isReadOnly,
  onCommit,
}: {
  id: string
  label: string
  ariaLabel?: string
  value: number
  isReadOnly: boolean
  onCommit: (nextValue: number) => void
}) => {
  const [draft, setDraft] = useState(String(value))

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={id}
        className="text-xs text-content-secondary w-12 shrink-0"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={draft}
        readOnly={isReadOnly}
        aria-label={ariaLabel}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onFocus={(event) => {
          event.target.select()
        }}
        onBlur={() => {
          const parsed = draft === "" ? 0 : Number(draft)
          onCommit(parsed)
        }}
        className="w-24 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
    </div>
  )
}
