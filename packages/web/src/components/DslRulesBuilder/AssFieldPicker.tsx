import { useRef, useState } from "react"

type AssFieldPickerProps = {
  label: string
  value: string
  options: readonly string[]
  isReadOnly: boolean
  inputId: string
  onChange: (newValue: string) => void
}

export const AssFieldPicker = ({
  label,
  value,
  options,
  isReadOnly,
  inputId,
  onChange,
}: AssFieldPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const queryLower = query.trim().toLowerCase()
  const filtered = queryLower
    ? options.filter((opt) =>
        opt.toLowerCase().includes(queryLower),
      )
    : options

  const open = () => {
    if (isReadOnly) return
    setQuery("")
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  const selectOption = (opt: string) => {
    onChange(opt)
    close()
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const trimmed = query.trim()
      if (trimmed) {
        onChange(trimmed)
        close()
      } else if (filtered.length > 0) {
        selectOption(filtered[0])
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={inputId}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={isReadOnly}
        onClick={open}
        className="w-32 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-left flex items-center gap-1 cursor-pointer disabled:cursor-default disabled:opacity-60"
      >
        <span className="flex-1 min-w-0 truncate">
          {value || (
            <span className="text-slate-500">Field</span>
          )}
        </span>
        {!isReadOnly && (
          <span className="text-slate-400 shrink-0">▾</span>
        )}
      </button>
      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-40 top-full left-0 mt-1 w-56 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
          style={{ maxHeight: 280 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or type custom…"
            className="shrink-0 w-full px-3 py-2 text-xs bg-transparent border-b border-slate-700 text-slate-200 placeholder:text-slate-500 outline-none"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            onKeyDown={handleKeyDown}
            onBlur={close}
            aria-autocomplete="list"
          />
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">
                No matches.
              </p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono ${
                    opt === value
                      ? "bg-blue-700 text-white"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => selectOption(opt)}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
