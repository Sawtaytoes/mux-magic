import { useAtom } from "jotai"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { type PathPickerState, pathPickerStateAtom, type TriggerRect } from "../state/pickerAtoms"
import type { DirEntry } from "../types"

const PICKER_WIDTH = 380
const PICKER_MAX_HEIGHT = 280

// ─── Async fetch ──────────────────────────────────────────────────────────────

const fetchDirEntries = async (
  parentPath: string,
): Promise<{ entries?: DirEntry[]; error?: string; separator?: string }> => {
  const response = await fetch("/queries/listDirectoryEntries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parentPath }),
  })
  return response.json() as Promise<{
    entries?: DirEntry[]
    error?: string
    separator?: string
  }>
}

// ─── Position ────────────────────────────────────────────────────────────────

const computePosition = (rect: TriggerRect) => {
  const margin = 8
  const width = PICKER_WIDTH
  const maxHeight = PICKER_MAX_HEIGHT
  const initialLeft = rect.left
  const clampedLeft = (() => {
    if (initialLeft + width > window.innerWidth - margin) {
      return Math.max(margin, window.innerWidth - width - margin)
    }
    if (initialLeft < margin) {
      return margin
    }
    return initialLeft
  })()
  const spaceBelow = window.innerHeight - rect.bottom - margin
  const spaceAbove = rect.top - margin
  const flipAbove = spaceBelow < 160 && spaceAbove > spaceBelow
  const { top, height } = (() => {
    if (flipAbove) {
      const flippedHeight = Math.min(maxHeight, Math.max(0, spaceAbove))
      return { top: rect.top - flippedHeight - 4, height: flippedHeight }
    }
    const droppedHeight = Math.min(maxHeight, Math.max(0, spaceBelow))
    return { top: rect.bottom + 4, height: droppedHeight }
  })()
  const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
  return { top: clampedTop, left: clampedLeft, maxHeight: height }
}

// ─── Matching ─────────────────────────────────────────────────────────────────

const computeMatches = (entries: DirEntry[] | null, query: string): DirEntry[] => {
  if (!entries) {
    return []
  }
  const queryLower = query.toLowerCase()
  return entries
    .filter((entry) => entry.isDirectory)
    .filter((entry) => !queryLower || entry.name.toLowerCase().startsWith(queryLower))
    .sort((entryA, entryB) => entryA.name.localeCompare(entryB.name))
}

// ─── Selection logic (pure) ───────────────────────────────────────────────────

const applySelection = (entry: DirEntry, state: PathPickerState) => {
  const { inputElement, target, parentPath } = state
  const separator = state.separator || "/"
  const base =
    parentPath.endsWith("/") || parentPath.endsWith("\\") ? parentPath.slice(0, -1) : parentPath
  const newValue = `${base}${separator}${entry.name}${separator}`
  ;(inputElement as HTMLInputElement).value = newValue
  if (target.mode === "step") {
    ;(
      window.setParam as ((stepId: string, fieldName: string, value: string) => void) | undefined
    )?.(target.stepId, target.fieldName, newValue)
  } else {
    window.mediaTools?.setPathValue?.(target.pathVarId, newValue)
  }
  return newValue
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PathPicker = () => {
  const [pickerState, setPickerState] = useAtom(pathPickerStateAtom)

  // Fires whenever parentPath or requestToken changes — the bridge sets a new
  // requestToken after the debounce delay, which kicks off the actual fetch.
  useEffect(() => {
    if (!pickerState) {
      return
    }
    const { parentPath, cachedParentPath, requestToken, entries } = pickerState
    if (cachedParentPath === parentPath && entries !== null) {
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
            return { ...prev, entries: [], error: data.error, matches: [] }
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
        const errorMessage = err instanceof Error ? err.message : String(err)
        setPickerState((prev) => {
          if (!prev || prev.requestToken !== requestToken) {
            return prev
          }
          return { ...prev, entries: [], error: errorMessage, matches: [] }
        })
      })

    return () => {
      cancelled = true
    }
  }, [pickerState?.parentPath, pickerState?.requestToken])

  useEffect(() => {
    if (!pickerState) {
      return
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const popover = document.getElementById("path-picker-react")
      if (popover?.contains(target)) {
        return
      }
      if (target === pickerState.inputElement) {
        return
      }
      setPickerState(null)
    }
    document.addEventListener("mousedown", handleMouseDown, true)
    return () => document.removeEventListener("mousedown", handleMouseDown, true)
  }, [pickerState, setPickerState])

  if (!pickerState) {
    return null
  }

  const { top, left, maxHeight } = computePosition(pickerState.triggerRect)
  const matches = pickerState.matches ?? computeMatches(pickerState.entries, pickerState.query)

  const handleSelectEntry = (entry: DirEntry) => {
    const current = pickerState
    setPickerState((snapshot) => {
      if (!snapshot) {
        return null
      }
      const newValue = applySelection(entry, snapshot)
      const trailingSlash = /[\\/]$/.test(newValue)
      const lastSepIndex = Math.max(newValue.lastIndexOf("/"), newValue.lastIndexOf("\\"))
      const newParentPath = lastSepIndex <= 0 ? newValue : newValue.slice(0, lastSepIndex) || "/"
      const newQuery = trailingSlash
        ? ""
        : lastSepIndex < 0
          ? newValue
          : newValue.slice(lastSepIndex + 1)
      const rawRect = snapshot.inputElement.getBoundingClientRect()
      return {
        ...snapshot,
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
        requestToken: snapshot.requestToken + 1,
      }
    })
    current.inputElement.focus()
  }

  return createPortal(
    <div
      id="path-picker-react"
      className="fixed z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col"
      style={{ top, left, width: PICKER_WIDTH, maxHeight }}
      data-testid="path-picker"
    >
      <div className="overflow-y-auto py-1">
        {pickerState.entries === null ? (
          <p className="text-xs text-slate-500 text-center py-3">Loading…</p>
        ) : pickerState.error ? (
          <p className="text-xs text-red-400 text-center py-3 wrap-break-word px-3">
            {pickerState.error}
          </p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">No matching entries.</p>
        ) : (
          matches.map((entry, index) => {
            const isActive = index === pickerState.activeIndex
            return (
              <button
                key={entry.name}
                type="button"
                tabIndex={-1}
                className={`w-full text-left px-3 py-1 flex items-center gap-2 ${
                  isActive ? "bg-blue-700 text-white" : "text-slate-200 hover:bg-slate-800"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectEntry(entry)}
              >
                <span className="shrink-0 text-slate-400">📁</span>
                <span className="font-mono text-xs flex-1 min-w-0 truncate">{entry.name}</span>
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
