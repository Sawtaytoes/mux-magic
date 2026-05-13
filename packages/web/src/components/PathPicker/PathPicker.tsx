import type { ListDirectoryEntriesResponse } from "@mux-magic/server/api-types"
import { useAtom, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { apiBase } from "../../apiBase"
import type { DirEntry } from "../../components/PathPicker/types"
import { setPathValueAtom } from "../../state/pathsAtom"
import {
  type PathPickerState,
  pathPickerStateAtom,
  type TriggerRect,
} from "../../state/pickerAtoms"
import { setParamAtom } from "../../state/stepAtoms"

const PICKER_WIDTH = 380
const PICKER_MAX_HEIGHT = 280

// â”€â”€â”€ Async fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fetchDirEntries = async (
  parentPath: string,
): Promise<ListDirectoryEntriesResponse> => {
  const response = await fetch(
    `${apiBase}/queries/listDirectoryEntries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: parentPath }),
    },
  )
  return response.json() as Promise<ListDirectoryEntriesResponse>
}

// â”€â”€â”€ Position â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const computePosition = (rect: TriggerRect) => {
  const margin = 8
  const width = PICKER_WIDTH
  const maxHeight = PICKER_MAX_HEIGHT
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
    spaceBelow < 160 && spaceAbove > spaceBelow
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

// â”€â”€â”€ Matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const computeMatches = (
  entries: DirEntry[] | null,
  query: string,
): DirEntry[] => {
  if (!entries) {
    return []
  }
  const queryLower = query.toLowerCase()
  return entries
    .filter((entry) => entry.isDirectory)
    .filter(
      (entry) =>
        !queryLower ||
        entry.name.toLowerCase().startsWith(queryLower),
    )
    .sort((entryA, entryB) =>
      entryA.name.localeCompare(entryB.name),
    )
}

// â”€â”€â”€ Value computation (pure) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const computeNewValue = (
  entry: DirEntry,
  state: PathPickerState,
): string => {
  const { parentPath } = state
  const separator = state.separator || "/"
  const base =
    parentPath.endsWith("/") || parentPath.endsWith("\\")
      ? parentPath.slice(0, -1)
      : parentPath
  return `${base}${separator}${entry.name}${separator}`
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const PathPicker = () => {
  const [pickerState, setPickerState] = useAtom(
    pathPickerStateAtom,
  )
  const setParam = useSetAtom(setParamAtom)
  const setPathValue = useSetAtom(setPathValueAtom)

  // Always-current ref so the keydown listener reads the latest state without
  // needing to re-attach on every atom update.
  const pickerStateRef = useRef(pickerState)
  pickerStateRef.current = pickerState

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const { inputElement } = pickerState
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = pickerStateRef.current
      if (!state) {
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setPickerState(null)
        return
      }
      const currentMatches =
        state.matches ??
        computeMatches(state.entries, state.query)
      if (!currentMatches.length) {
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setPickerState((prev) =>
          prev
            ? {
                ...prev,
                activeIndex:
                  (prev.activeIndex + 1) %
                  currentMatches.length,
              }
            : null,
        )
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setPickerState((prev) =>
          prev
            ? {
                ...prev,
                activeIndex:
                  (prev.activeIndex -
                    1 +
                    currentMatches.length) %
                  currentMatches.length,
              }
            : null,
        )
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        const popover = document.getElementById(
          "path-picker-popover",
        )
        const buttons = popover?.querySelectorAll("button")
        const activeButton = buttons?.[state.activeIndex]
        activeButton?.click()
      }
    }
    inputElement.addEventListener("keydown", handleKeyDown)
    return () =>
      inputElement.removeEventListener(
        "keydown",
        handleKeyDown,
      )
  }, [pickerState, setPickerState])

  // Fires whenever parentPath or requestToken changes â€” the bridge sets a new
  // requestToken after the debounce delay, which kicks off the actual fetch.
  useEffect(() => {
    if (!pickerState) {
      return
    }
    const {
      parentPath,
      cachedParentPath,
      requestToken,
      entries,
    } = pickerState
    if (
      cachedParentPath === parentPath &&
      entries !== null
    ) {
      return
    }

    let cancelled = false
    fetchDirEntries(parentPath)
      .then((data) => {
        if (cancelled) {
          return
        }
        setPickerState((prev) => {
          if (!prev || prev.requestToken !== requestToken) {
            return prev
          }
          if (data.error) {
            return {
              ...prev,
              entries: [],
              error: data.error,
              matches: [],
            }
          }
          const newEntries = data.entries ?? []
          const separator = data.separator ?? prev.separator
          return {
            ...prev,
            entries: newEntries,
            error: null,
            separator,
            cachedParentPath: parentPath,
            matches: computeMatches(newEntries, prev.query),
            activeIndex: 0,
          }
        })
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        setPickerState((prev) => {
          if (!prev || prev.requestToken !== requestToken) {
            return prev
          }
          return {
            ...prev,
            entries: [],
            error: errorMessage,
            matches: [],
          }
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    pickerState?.parentPath,
    pickerState?.requestToken,
    setPickerState,
    pickerState,
  ])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById(
        "path-picker-popover",
      )
      if (popover?.contains(target)) {
        return
      }
      if (target === pickerState.inputElement) {
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

  if (!pickerState) {
    return null
  }

  const { top, left, maxHeight } = computePosition(
    pickerState.triggerRect,
  )
  const matches =
    pickerState.matches ??
    computeMatches(pickerState.entries, pickerState.query)

  const handleSelectEntry = (entry: DirEntry) => {
    const snapshot = pickerState
    const newValue = computeNewValue(entry, snapshot)

    // Update DOM input immediately so the field reflects the selection.
    ;(snapshot.inputElement as HTMLInputElement).value =
      newValue

    // Dispatch to the appropriate atom.
    if (snapshot.target.mode === "step") {
      setParam({
        stepId: snapshot.target.stepId,
        fieldName: snapshot.target.fieldName,
        value: newValue,
      })
    } else {
      setPathValue({
        pathVariableId: snapshot.target.pathVariableId,
        value: newValue,
      })
    }

    // Compute updated picker navigation state.
    const trailingSlash = /[\\/]$/.test(newValue)
    const lastSepIndex = Math.max(
      newValue.lastIndexOf("/"),
      newValue.lastIndexOf("\\"),
    )
    const newParentPath =
      lastSepIndex <= 0
        ? newValue
        : newValue.slice(0, lastSepIndex) || "/"
    const newQuery = trailingSlash
      ? ""
      : lastSepIndex < 0
        ? newValue
        : newValue.slice(lastSepIndex + 1)

    setPickerState((prev) => {
      if (!prev) {
        return null
      }
      const rawRect =
        prev.inputElement.getBoundingClientRect()
      return {
        ...prev,
        parentPath: newParentPath,
        query: newQuery,
        triggerRect: {
          left: rawRect.left,
          top: rawRect.top,
          right: rawRect.right,
          bottom: rawRect.bottom,
          width: rawRect.width,
          height: rawRect.height,
        },
        activeIndex: 0,
        requestToken: prev.requestToken + 1,
      }
    })

    snapshot.inputElement.focus()
  }

  return createPortal(
    <div
      id="path-picker-popover"
      role="listbox"
      aria-label="Path picker"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
    >
      <div className="overflow-y-auto py-1">
        {pickerState.entries === null ? (
          <p className="text-xs text-slate-500 text-center py-3">
            Loadingâ€¦
          </p>
        ) : pickerState.error ? (
          <p className="text-xs text-red-400 text-center py-3 wrap-break-word px-3">
            {pickerState.error}
          </p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">
            No matching entries.
          </p>
        ) : (
          matches.map((entry, index) => {
            const isActive =
              index === pickerState.activeIndex
            return (
              <button
                key={entry.name}
                type="button"
                tabIndex={-1}
                className={`w-full text-left px-3 py-1 flex items-center gap-2 ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => handleSelectEntry(entry)}
              >
                <span className="shrink-0 text-slate-400">
                  ðŸ“
                </span>
                <span className="font-mono text-xs flex-1 min-w-0 truncate">
                  {entry.name}
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
