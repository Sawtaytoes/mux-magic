import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"

const MAX_HEIGHT_PX = 192
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

type PortalDropdownProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  isOpen: boolean
  items: ReadonlyArray<PortalDropdownItem>
}

export const PortalDropdown = ({
  anchorRef,
  isOpen,
  items,
}: PortalDropdownProps) => {
  const [position, setPosition] =
    useState<PortalDropdownPosition | null>(null)

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
        spaceBelow < MAX_HEIGHT_PX &&
        spaceAbove > spaceBelow
      const available = isFlippedUp
        ? spaceAbove
        : spaceBelow
      const maxHeight = Math.max(
        MIN_HEIGHT_PX,
        Math.min(MAX_HEIGHT_PX, available),
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
  }, [isOpen, anchorRef])

  if (!isOpen || items.length === 0 || !position) {
    return null
  }

  return createPortal(
    <div
      role="listbox"
      style={{
        position: "fixed",
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      className="z-50 bg-slate-800 border border-slate-600 rounded shadow-lg overflow-y-auto"
    >
      {items.map((item) => (
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
      ))}
    </div>,
    document.body,
  )
}
