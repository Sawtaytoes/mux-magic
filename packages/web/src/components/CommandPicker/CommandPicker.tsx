import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { createPortal, flushSync } from "react-dom"
// Single source of truth — the picker's tag ordering must match the
// canonical list in commands.ts so new tags (e.g. "Flow Control") flow
// through automatically. Previously a local copy of this list lived
// here and silently dropped any command whose tag wasn't enumerated.
import { TAG_ORDER } from "../../commands/commands"
import type { Commands } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { commandLabel } from "../../jobs/commandLabels"
import { findStepById } from "../../jobs/sequenceUtils"
import { commandsAtom } from "../../state/commandsAtom"
import {
  type CommandPickerAnchor,
  commandPickerStateAtom,
  type TriggerRect,
} from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { SequenceItem } from "../../types"

const PICKER_WIDTH = 340
const PICKER_MAX_HEIGHT = 400

type CommandItem = { name: string; tag: string }

const buildItems = (commands: Commands): CommandItem[] =>
  TAG_ORDER.flatMap((tag) =>
    Object.entries(commands)
      .filter(([, command]) => command.tag === tag)
      .map(([name]) => ({ name, tag }))
      .sort((itemA, itemB) =>
        commandLabel(itemA.name).localeCompare(
          commandLabel(itemB.name),
        ),
      ),
  )

const matchesQuery = (item: CommandItem, query: string) =>
  item.name.toLowerCase().includes(query) ||
  commandLabel(item.name).toLowerCase().includes(query) ||
  item.tag.toLowerCase().includes(query)

const findInitialIndex = (
  items: CommandItem[],
  anchor: CommandPickerAnchor,
  steps: SequenceItem[],
): number => {
  const step = findStepById(steps, anchor.stepId)
  const currentCommand = step?.command
  const idx = items.findIndex(
    (item) => item.name === currentCommand,
  )
  return idx >= 0 ? idx : 0
}

type PickerPosition = {
  top: number
  left: number
  maxHeight: number
}

const computePosition = (
  rect: TriggerRect,
  alignSide: "left" | "right",
  width: number,
  maxHeight: number,
): PickerPosition => {
  const margin = 8
  const initialLeft =
    alignSide === "right" ? rect.right - width : rect.left
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
  const isFlippedAbove =
    spaceBelow < 200 && spaceAbove > spaceBelow
  const { top, height } = (() => {
    if (isFlippedAbove) {
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

export const CommandPicker = () => {
  const [pickerState, setPickerState] = useAtom(
    commandPickerStateAtom,
  )
  const commands = useAtomValue(commandsAtom)
  const allSteps = useAtomValue(stepsAtom)
  const { changeCommand } = useBuilderActions()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = pickerState ? buildItems(commands) : []
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
    const items = buildItems(commands)
    setQuery("")
    setActiveIndex(
      findInitialIndex(items, pickerState.anchor, allSteps),
    )
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [
    pickerState?.anchor.stepId,
    pickerState?.anchor,
    pickerState,
    commands,
    allSteps,
  ])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById(
        "cmd-picker-react",
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

  const selectItem = (item: CommandItem) => {
    const anchor = pickerState?.anchor
    flushSync(() => {
      close()
    })
    if (anchor) {
      changeCommand(anchor.stepId, item.name)
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
    "left",
    PICKER_WIDTH,
    PICKER_MAX_HEIGHT,
  )

  return createPortal(
    <div
      id="cmd-picker-react"
      role="listbox"
      aria-label="Command picker"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search commands…"
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
            No commands match.
          </p>
        ) : (
          filtered.map((item, index) => {
            const isActive = index === safeActiveIndex
            return (
              <button
                key={item.name}
                type="button"
                aria-pressed={isActive}
                className={`w-full text-left px-3 py-1.5 flex items-start gap-2 ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => selectItem(item)}
              >
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-xs truncate">
                    {commandLabel(item.name)}
                  </span>
                  <span
                    className={`font-mono text-[10px] truncate ${
                      isActive
                        ? "text-blue-200"
                        : "text-slate-500"
                    }`}
                  >
                    {item.name}
                  </span>
                </span>
                <span
                  className={`text-[10px] shrink-0 mt-0.5 ${
                    isActive
                      ? "text-blue-200"
                      : "text-slate-500"
                  }`}
                >
                  {item.tag}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
