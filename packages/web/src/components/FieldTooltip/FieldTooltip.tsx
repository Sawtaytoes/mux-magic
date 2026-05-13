import { useRef, useState } from "react"
import { createPortal } from "react-dom"

const HOVER_DELAY_MS = 200

interface TooltipPosition {
  top: number
  left: number
}

interface FieldTooltipProps {
  description: string
  children: React.ReactNode
}

export const FieldTooltip = ({
  description,
  children,
}: FieldTooltipProps) => {
  const [position, setPosition] =
    useState<TooltipPosition | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const computePosition = (
    anchorRect: DOMRect,
  ): TooltipPosition => {
    const GAP = 6
    const MARGIN = 8
    const tooltipEl = tooltipRef.current

    const tooltipHeight = tooltipEl?.offsetHeight ?? 0
    const tooltipWidth = tooltipEl?.offsetWidth ?? 200

    const preferredTop = anchorRect.bottom + GAP
    const isOverflowingBottom =
      preferredTop + tooltipHeight >
      window.innerHeight - MARGIN
    const top = isOverflowingBottom
      ? Math.max(
          MARGIN,
          anchorRect.top - tooltipHeight - GAP,
        )
      : preferredTop

    const preferredLeft = anchorRect.left
    const left = Math.max(
      MARGIN,
      Math.min(
        preferredLeft,
        window.innerWidth - tooltipWidth - MARGIN,
      ),
    )

    return { top, left }
  }

  const showTooltip = () => {
    if (!description || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPosition(computePosition(rect))
  }

  const hideTooltip = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPosition(null)
  }

  const handlePointerEnter = () => {
    if (!description) return
    timerRef.current = setTimeout(
      showTooltip,
      HOVER_DELAY_MS,
    )
  }

  const handlePointerLeave = () => {
    hideTooltip()
  }

  const handleClick = () => {
    if (!description) return
    if (position !== null) {
      hideTooltip()
    } else {
      if (timerRef.current !== null)
        clearTimeout(timerRef.current)
      showTooltip()
    }
  }

  return (
    <>
      <span
        role="none"
        ref={anchorRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            handleClick()
        }}
      >
        {children}
      </span>
      {position !== null &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className="fixed z-50 max-w-xs px-2.5 py-1.5 text-xs text-slate-200 bg-slate-800 border border-slate-600 rounded shadow-lg leading-relaxed pointer-events-none"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            {description}
          </div>,
          document.body,
        )}
    </>
  )
}
