import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"

type LanguageOption = {
  code: string
  name: string
}

type Position = {
  top: number
  left: number
  width: number
}

type LanguageDropdownProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  isOpen: boolean
  options: LanguageOption[]
  onSelect: (code: string) => void
}

export const LanguageDropdown = ({
  anchorRef,
  isOpen,
  options,
  onSelect,
}: LanguageDropdownProps) => {
  const [position, setPosition] = useState<Position | null>(
    null,
  )

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }
    const update = () => {
      const node = anchorRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [isOpen, anchorRef])

  if (!isOpen || options.length === 0 || !position) {
    return null
  }

  return createPortal(
    <div
      role="listbox"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
      }}
      className="z-50 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto"
    >
      {options.map(({ code, name }) => (
        <div
          key={code}
          role="option"
          aria-selected={false}
          tabIndex={-1}
          onMouseDown={() => onSelect(code)}
          className="flex flex-col px-2 py-1.5 cursor-pointer hover:bg-slate-700 text-slate-200"
        >
          <span className="text-xs">{name}</span>
          <span className="font-mono text-slate-400 text-xs">
            {code}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  )
}
