import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { findStepById } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import {
  type EnumPickerAnchor,
  enumPickerStateAtom,
  type TriggerRect,
} from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  Commands,
  EnumOption,
  SequenceItem,
} from "../../types"

const PICKER_WIDTH = 300
const PICKER_MAX_HEIGHT = 400

const buildItems = (
  anchor: EnumPickerAnchor,
  commands: Commands,
  steps: SequenceItem[],
): EnumOption[] => {
  const step = findStepById(steps, anchor.stepId)
  if (!step?.command) {
    return []
  }
  const command = commands[step.command]
  const field = command?.fields?.find(
    (candidate) => candidate.name === anchor.fieldName,
  )
  return field?.options ?? []
}

const findInitialIndex = (
  items: EnumOption[],
  anchor: EnumPickerAnchor,
  commands: Commands,
  steps: SequenceItem[],
): number => {
  const step = findStepById(steps, anchor.stepId)
  const currentValue = step?.params?.[anchor.fieldName]
  const command = step?.command
    ? commands[step.command]
    : undefined
  const field = command?.fields?.find(
    (candidate) => candidate.name === anchor.fieldName,
  )
  const effectiveValue = currentValue ?? field?.default
  const idx = items.findIndex(
    (item) => item.value === effectiveValue,
  )
  return idx >= 0 ? idx : 0
}

const matchesQuery = (item: EnumOption, query: string) =>
  item.label.toLowerCase().includes(query) ||
  String(item.value).toLowerCase().includes(query)

const computePosition = (
  rect: TriggerRect,
  width: number,
  maxHeight: number,
) => {
  const margin = 8
  const initialLeft = rect.left
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

export const EnumPicker = () => {
  const [pickerState, setPickerState] = useAtom(
    enumPickerStateAtom,
  )
  const commands = useAtomValue(commandsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const { setParam } = useBuilderActions()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = pickerState
    ? buildItems(pickerState.anchor, commands, allSteps)
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
      commands,
      allSteps,
    )
    setQuery("")
    setActiveIndex(
      findInitialIndex(
        items,
        pickerState.anchor,
        commands,
        allSteps,
      ),
    )
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [pickerState, commands, allSteps])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById(
        "enum-picker-react",
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

  const selectItem = (item: EnumOption) => {
    const anchor = pickerState?.anchor
    close()
    if (anchor) {
      setParam(anchor.stepId, anchor.fieldName, item.value)
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
      id="enum-picker-react"
      role="listbox"
      aria-label="Option picker"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
      data-testid="enum-picker"
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search options…"
        className="shrink-0 w-full px-3 py-2 text-xs bg-transparent border-b border-slate-700 text-slate-200 placeholder:text-slate-500 outline-none"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
      />
      <div className="overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No options match.
          </p>
        ) : (
          filtered.map((item, index) => {
            const isActive = index === safeActiveIndex
            return (
              <button
                key={String(item.value)}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`w-full text-left px-3 py-1.5 text-xs ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => selectItem(item)}
              >
                {item.label}
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
