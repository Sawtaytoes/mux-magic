import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { pathsAtom } from "../../state/pathsAtom"
import {
  type LinkPickerAnchor,
  linkPickerStateAtom,
  type TriggerRect,
} from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  Group,
  PathVar,
  SequenceItem,
  Step,
  StepLink,
} from "../../types"

const PICKER_WIDTH = 360
const PICKER_MAX_HEIGHT = 400

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isGroup = (item: SequenceItem): item is Group =>
  (item as Group).kind === "group"

type FlatEntry = { step: Step; flatIndex: number }

const flattenSteps = (
  items: SequenceItem[],
): FlatEntry[] => {
  const result: FlatEntry[] = []
  let counter = 0
  for (const item of items) {
    if (isGroup(item)) {
      for (const step of item.steps) {
        result.push({ step, flatIndex: counter++ })
      }
    } else {
      result.push({ step: item, flatIndex: counter++ })
    }
  }
  return result
}

const getCommandLabel = (name: string): string =>
  commandLabel(name)

const makePathBreakable = (text: string) =>
  text.replace(/([/\\])/g, "​$1")

// ─── Link item types ──────────────────────────────────────────────────────────

type PathLinkItem = {
  kind: "path"
  value: string
  label: string
  detail: string
  pathVarId: string
}

type StepLinkItem = {
  kind: "step"
  value: string
  label: string
  detail: string
  sourceStepId: string
}

type LinkItem = PathLinkItem | StepLinkItem

const buildItems = (
  anchor: LinkPickerAnchor,
  allSteps: SequenceItem[],
  paths: PathVar[],
): LinkItem[] => {
  const flatOrder = flattenSteps(allSteps)
  const currentIndex = flatOrder.findIndex(
    (entry) => entry.step.id === anchor.stepId,
  )
  if (currentIndex < 0) {
    return []
  }

  const items: LinkItem[] = []

  for (const pathVar of paths) {
    items.push({
      kind: "path",
      value: `path:${pathVar.id}`,
      label: pathVar.label || "(unnamed)",
      detail: pathVar.value || "",
      pathVarId: pathVar.id,
    })
  }

  for (const entry of flatOrder.slice(0, currentIndex)) {
    const previousStep = entry.step
    if (previousStep.command === null) {
      continue
    }
    items.push({
      kind: "step",
      value: `step:${previousStep.id}:folder`,
      label: `Step ${entry.flatIndex + 1}: ${getCommandLabel(previousStep.command)}`,
      detail: "",
      sourceStepId: previousStep.id,
    })
  }

  return items
}

const findInitialIndex = (
  items: LinkItem[],
  anchor: LinkPickerAnchor,
  allSteps: SequenceItem[],
): number => {
  const flatOrder = flattenSteps(allSteps)
  const entry = flatOrder.find(
    (flatEntry) => flatEntry.step.id === anchor.stepId,
  )
  if (!entry) {
    return 0
  }
  const link: StepLink | undefined =
    entry.step.links?.[anchor.fieldName]
  if (typeof link === "string") {
    const idx = items.findIndex(
      (item) =>
        item.kind === "path" && item.pathVarId === link,
    )
    return idx >= 0 ? idx : 0
  }
  if (link && typeof link === "object" && link.linkedTo) {
    const idx = items.findIndex(
      (item) =>
        item.kind === "step" &&
        item.sourceStepId === link.linkedTo,
    )
    return idx >= 0 ? idx : 0
  }
  return 0
}

const matchesQuery = (item: LinkItem, query: string) =>
  item.label.toLowerCase().includes(query) ||
  item.detail.toLowerCase().includes(query)

const computePosition = (
  rect: TriggerRect,
  width: number,
  maxHeight: number,
) => {
  const margin = 8
  // Link picker aligns to the right edge of its trigger
  const initialLeft = rect.right - width
  const clampedLeft = (() => {
    if (initialLeft + width > window.innerWidth - margin) {
      return Math.max(
        margin,
        window.innerWidth - width - margin,
      )
    }
    if (initialLeft < margin) {
      return margin
    }
    return initialLeft
  })()
  const spaceBelow =
    window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const flipAbove =
    spaceBelow < 200 && spaceAbove > spaceBelow
  const { top, height } = (() => {
    if (flipAbove) {
      const flippedHeight = Math.min(
        maxHeight,
        Math.max(0, spaceAbove),
      )
      return {
        top: rect.top - flippedHeight - 4,
        height: flippedHeight,
      }
    }
    const droppedHeight = Math.min(
      maxHeight,
      Math.max(0, spaceBelow),
    )
    return { top: rect.bottom + 4, height: droppedHeight }
  })()
  const clampedTop = Math.max(
    margin,
    Math.min(top, window.innerHeight - height - margin),
  )
  return {
    top: clampedTop,
    left: clampedLeft,
    maxHeight: height,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkPicker = () => {
  const [pickerState, setPickerState] = useAtom(
    linkPickerStateAtom,
  )
  const allSteps = useAtomValue(stepsAtom)
  const paths = useAtomValue(pathsAtom)
  const { setLink } = useBuilderActions()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = pickerState
    ? buildItems(pickerState.anchor, allSteps, paths)
    : []
  const queryLower = query.trim().toLowerCase()
  const filtered = queryLower
    ? allItems.filter((item) =>
        matchesQuery(item, queryLower),
      )
    : allItems
  const safeActiveIndex =
    activeIndex >= filtered.length ? 0 : activeIndex

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const items = buildItems(
      pickerState.anchor,
      allSteps,
      paths,
    )
    setQuery("")
    setActiveIndex(
      findInitialIndex(items, pickerState.anchor, allSteps),
    )
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [pickerState, allSteps, paths])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById(
        "link-picker-react",
      )
      if (popover?.contains(target)) {
        return
      }
      setPickerState(null)
    }
    document.addEventListener(
      "mousedown",
      handleMouseDown,
      true,
    )
    return () =>
      document.removeEventListener(
        "mousedown",
        handleMouseDown,
        true,
      )
  }, [pickerState, setPickerState])

  const close = () => setPickerState(null)

  const selectItem = (item: LinkItem) => {
    const anchor = pickerState?.anchor
    close()
    if (anchor) {
      setLink(anchor.stepId, anchor.fieldName, item.value)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (!filtered.length) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filtered.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (prev) =>
          (prev - 1 + filtered.length) % filtered.length,
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (filtered[safeActiveIndex]) {
        selectItem(filtered[safeActiveIndex])
      }
    }
  }

  if (!pickerState) {
    return null
  }

  const { top, left, maxHeight } = computePosition(
    pickerState.triggerRect,
    PICKER_WIDTH,
    PICKER_MAX_HEIGHT,
  )

  return createPortal(
    <div
      id="link-picker-react"
      role="listbox"
      aria-label="Link picker"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
      data-testid="link-picker"
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search locations…"
        className="shrink-0 w-full px-3 py-2 text-xs bg-transparent border-b border-slate-700 text-slate-200 placeholder:text-slate-500 outline-none"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
      />
      <div className="overflow-y-auto py-1 flex-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No matches.
          </p>
        ) : (
          filtered.map((item, index) => {
            const isActive = index === safeActiveIndex
            const labelClass = `text-xs ${isActive ? "text-white" : "text-slate-200"} ${item.kind === "path" ? "font-medium" : "font-mono"}`
            const detailClass = `path-detail font-mono text-[11px] pl-4 ${isActive ? "text-blue-100" : "text-slate-400"}`
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`w-full text-left px-3 py-1.5 ${isActive ? "bg-blue-700" : "hover:bg-slate-800"}`}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => selectItem(item)}
              >
                <div className={labelClass}>
                  {item.label}
                </div>
                {item.detail && (
                  <div className={detailClass}>
                    {makePathBreakable(item.detail)}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
