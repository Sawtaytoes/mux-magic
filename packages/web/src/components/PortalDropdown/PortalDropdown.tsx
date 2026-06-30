import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

const DEFAULT_MAX_HEIGHT_PX = 400
const GAP_PX = 4
const VIEWPORT_MARGIN_PX = 8
const MIN_HEIGHT_PX = 64

type Placement = "below" | "above"

type PortalDropdownPosition = {
  placement: Placement
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

export type PortalDropdownItem = {
  key: string
  onSelect: () => void
  content: React.ReactNode
}

// Optional sticky search box rendered at the top of the listbox. The
// consumer owns the query value and the filtering of `items`; this just
// renders the input and reports keystrokes. When present, the dropdown
// stays open on an empty `items` list so the user can keep refining the
// query (instead of the list vanishing on the first no-match).
export type PortalDropdownSearch = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
}

type PortalDropdownProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  isOpen: boolean
  items: ReadonlyArray<PortalDropdownItem>
  maxHeightPx?: number
  search?: PortalDropdownSearch
  // When provided, the dropdown dismisses itself on a pointer-down outside
  // both the anchor and the listbox (and on Escape from the search box).
  // This replaces the consumer's trigger-blur dismissal, which races with
  // focus moving into the in-dropdown search input.
  onClose?: () => void
}

export const PortalDropdown = ({
  anchorRef,
  isOpen,
  items,
  maxHeightPx = DEFAULT_MAX_HEIGHT_PX,
  search,
  onClose,
}: PortalDropdownProps) => {
  const [position, setPosition] =
    useState<PortalDropdownPosition | null>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const hasSearch = Boolean(search)

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }
    const update = () => {
      const node = anchorRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const spaceBelow =
        window.innerHeight -
        rect.bottom -
        GAP_PX -
        VIEWPORT_MARGIN_PX
      const spaceAbove =
        rect.top - GAP_PX - VIEWPORT_MARGIN_PX
      const isFlippedUp =
        spaceBelow < maxHeightPx && spaceAbove > spaceBelow
      const available = isFlippedUp
        ? spaceAbove
        : spaceBelow
      const maxHeight = Math.max(
        MIN_HEIGHT_PX,
        Math.min(maxHeightPx, available),
      )
      setPosition(
        isFlippedUp
          ? {
              placement: "above",
              bottom:
                window.innerHeight - rect.top + GAP_PX,
              left: rect.left,
              width: rect.width,
              maxHeight,
            }
          : {
              placement: "below",
              top: rect.bottom + GAP_PX,
              left: rect.left,
              width: rect.width,
              maxHeight,
            },
      )
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [isOpen, anchorRef, maxHeightPx])

  // Dismiss on a pointer-down outside the anchor and the listbox. Only wired
  // when `onClose` is provided (the searchable path) — capture phase so it
  // runs before an option's onMouseDown selection, and the anchor is excluded
  // so the trigger's own onClick can toggle without a double-close.
  useEffect(() => {
    if (!isOpen || !onClose) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (listboxRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener(
      "mousedown",
      handlePointerDown,
      true,
    )
    return () =>
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
        true,
      )
  }, [isOpen, onClose, anchorRef])

  // Focus the search box when the dropdown opens (position is set on the
  // layout pass, so the input exists by the time this runs). The
  // already-focused guard keeps a scroll-driven reposition from yanking the
  // caret back mid-type.
  useEffect(() => {
    if (!isOpen || !hasSearch || !position) return
    const input = searchInputRef.current
    if (input && document.activeElement !== input) {
      input.focus()
    }
  }, [isOpen, hasSearch, position])

  // With a search box the dropdown must stay mounted on an empty list so the
  // user can keep typing; without one, an empty list renders nothing.
  if (!isOpen || !position) {
    return null
  }
  if (items.length === 0 && !search) {
    return null
  }

  return createPortal(
    <div
      ref={listboxRef}
      role="listbox"
      style={{
        position: "fixed",
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      className="z-50 bg-slate-800 border border-slate-600 rounded shadow-lg flex flex-col overflow-hidden"
    >
      {search && (
        <input
          ref={searchInputRef}
          type="text"
          aria-label="Filter options"
          placeholder={search.placeholder ?? "Search…"}
          value={search.value}
          onChange={(event) =>
            search.onChange(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onClose?.()
            }
          }}
          className="shrink-0 w-full px-2 py-1.5 text-xs bg-slate-900 text-slate-100 border-b border-slate-600 placeholder:text-slate-500 outline-none"
        />
      )}
      <div className="overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-slate-500 text-center">
            {search?.emptyLabel ?? "No matches"}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              role="option"
              aria-selected={false}
              tabIndex={-1}
              onMouseDown={item.onSelect}
              className="flex flex-col px-2 py-1.5 cursor-pointer hover:bg-slate-700 text-slate-200"
            >
              {item.content}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  )
}
