import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

// The Variables rail is a fixed-width column only at @charcuterie/ui's `md`
// breakpoint (48rem) and above — below it the Rail relocates to a horizontal
// strip, where a fixed pixel width and a sticky/scroll treatment make no
// sense. Everything here is gated on that query.
const WIDE_VIEWPORT_QUERY = "(min-width: 48rem)"

const RAIL_WIDTH_STORAGE_KEY =
  "mux-magic:variables-rail-width"
const MINIMUM_RAIL_WIDTH = 240
const MAXIMUM_RAIL_WIDTH = 560
const DEFAULT_RAIL_WIDTH = 320
const KEYBOARD_RESIZE_STEP = 16

const clampRailWidth = (width: number) =>
  Math.min(
    MAXIMUM_RAIL_WIDTH,
    Math.max(MINIMUM_RAIL_WIDTH, width),
  )

const readStoredRailWidth = () => {
  try {
    const stored = window.localStorage.getItem(
      RAIL_WIDTH_STORAGE_KEY,
    )
    const parsed =
      stored === null
        ? Number.NaN
        : Number.parseInt(stored, 10)
    return Number.isNaN(parsed)
      ? DEFAULT_RAIL_WIDTH
      : clampRailWidth(parsed)
  } catch {
    return DEFAULT_RAIL_WIDTH
  }
}

const writeStoredRailWidth = (width: number) => {
  try {
    window.localStorage.setItem(
      RAIL_WIDTH_STORAGE_KEY,
      String(width),
    )
  } catch {
    // A page that cannot persist still resizes for this session.
  }
}

const getIsWideViewport = () =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_VIEWPORT_QUERY).matches
    : false

const subscribeToWideViewport = (onChange: () => void) => {
  const mediaQueryList =
    typeof window.matchMedia === "function"
      ? window.matchMedia(WIDE_VIEWPORT_QUERY)
      : null
  mediaQueryList?.addEventListener("change", onChange)
  return () => {
    mediaQueryList?.removeEventListener("change", onChange)
  }
}

/**
 * Width/sticky state for the Variables rail: a user-draggable width that
 * persists to `localStorage`, plus the sticky offset + max-height that keep
 * the panel in view (with its own scrollbar) instead of scrolling away.
 */
export const useResizableRail = () => {
  const [railWidth, setRailWidth] = useState(
    readStoredRailWidth,
  )
  const [headerHeight, setHeaderHeight] = useState(0)

  // Mirrors railWidth but is updated *synchronously* on every change, not on
  // render — so a pointerup that fires in the same tick as the final
  // pointermove (and the drag-start reader) sees the true current width rather
  // than last render's stale value.
  const latestWidthRef = useRef(railWidth)

  const applyWidth = useCallback((nextWidth: number) => {
    latestWidthRef.current = nextWidth
    setRailWidth(nextWidth)
  }, [])

  const dragOriginRef = useRef<{
    pointerX: number
    width: number
  } | null>(null)

  const isWideViewport = useSyncExternalStore(
    subscribeToWideViewport,
    getIsWideViewport,
    () => false,
  )

  // Track the sticky header's live height so the rail parks directly beneath
  // it (`top`) and its scroll region never runs off the bottom of the
  // viewport (`max-height`), regardless of how the header wraps.
  useEffect(() => {
    const header = document.getElementById("page-header")
    if (header === null) {
      return
    }
    const observer = new ResizeObserver(() => {
      setHeaderHeight(header.getBoundingClientRect().height)
    })
    observer.observe(header)
    return () => {
      observer.disconnect()
    }
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragOrigin = dragOriginRef.current
      if (dragOrigin === null) {
        return
      }
      // The rail sits on the right; dragging its left edge leftward (a smaller
      // clientX) should widen it.
      applyWidth(
        clampRailWidth(
          dragOrigin.width +
            (dragOrigin.pointerX - event.clientX),
        ),
      )
    },
    [applyWidth],
  )

  const stopDragging = useCallback(() => {
    dragOriginRef.current = null
    window.removeEventListener(
      "pointermove",
      handlePointerMove,
    )
    window.removeEventListener("pointerup", stopDragging)
    writeStoredRailWidth(latestWidthRef.current)
  }, [handlePointerMove])

  const handleResizeHandlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault()
      dragOriginRef.current = {
        pointerX: event.clientX,
        width: latestWidthRef.current,
      }
      window.addEventListener(
        "pointermove",
        handlePointerMove,
      )
      window.addEventListener("pointerup", stopDragging)
    },
    [handlePointerMove, stopDragging],
  )

  const handleResizeHandleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      const requestedWidth =
        event.key === "ArrowLeft"
          ? latestWidthRef.current + KEYBOARD_RESIZE_STEP
          : event.key === "ArrowRight"
            ? latestWidthRef.current - KEYBOARD_RESIZE_STEP
            : event.key === "Home"
              ? MAXIMUM_RAIL_WIDTH
              : event.key === "End"
                ? MINIMUM_RAIL_WIDTH
                : null
      if (requestedWidth === null) {
        return
      }
      event.preventDefault()
      const nextWidth = clampRailWidth(requestedWidth)
      applyWidth(nextWidth)
      writeStoredRailWidth(nextWidth)
    },
    [applyWidth],
  )

  useEffect(
    () => () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      )
      window.removeEventListener("pointerup", stopDragging)
    },
    [handlePointerMove, stopDragging],
  )

  const railStyle: CSSProperties | undefined =
    isWideViewport
      ? {
          width: `${railWidth}px`,
          position: "sticky",
          top: headerHeight,
          alignSelf: "start",
          maxHeight: `calc(100dvh - ${headerHeight}px)`,
        }
      : undefined

  const resizeHandleProps = {
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    "aria-label": "Resize variables sidebar",
    "aria-valuemin": MINIMUM_RAIL_WIDTH,
    "aria-valuemax": MAXIMUM_RAIL_WIDTH,
    "aria-valuenow": Math.round(railWidth),
    tabIndex: 0,
    onPointerDown: handleResizeHandlePointerDown,
    onKeyDown: handleResizeHandleKeyDown,
  }

  return { isWideViewport, railStyle, resizeHandleProps }
}
