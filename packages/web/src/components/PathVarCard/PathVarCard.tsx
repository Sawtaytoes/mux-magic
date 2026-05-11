import { useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { pathsAtom } from "../../state/pathsAtom"
import { pathPickerStateAtom } from "../../state/pickerAtoms"
import { fileExplorerAtom } from "../../state/uiAtoms"
import type { PathVar } from "../../types"

interface PathVarCardProps {
  pathVar: PathVar
  isFirst: boolean
}

export const PathVarCard = ({
  pathVar,
  isFirst,
}: PathVarCardProps) => {
  const setPaths = useSetAtom(pathsAtom)
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const setPathPickerState = useSetAtom(pathPickerStateAtom)

  const valueInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    },
    [],
  )

  const setLabel = (label: string) => {
    setPaths((paths) =>
      paths.map((path) =>
        path.id === pathVar.id ? { ...path, label } : path,
      ),
    )
  }

  const setValue = (value: string) => {
    setPaths((paths) =>
      paths.map((path) =>
        path.id === pathVar.id ? { ...path, value } : path,
      ),
    )
  }

  const removePath = () => {
    setPaths((paths) =>
      paths.filter((path) => path.id !== pathVar.id),
    )
  }

  const handleBrowse = async () => {
    if (pathVar.value) {
      setFileExplorer({
        path: pathVar.value,
        pickerOnSelect: null,
      })
    } else {
      let startPath = "/"
      try {
        const response = await fetch("/files/default-path")
        const data = (await response.json()) as {
          path?: string
        }
        startPath = data.path ?? "/"
      } catch {
        // fall back to "/"
      }
      setFileExplorer({
        path: startPath,
        pickerOnSelect: (selectedPath) => {
          setValue(selectedPath)
        },
      })
    }
  }

  const handleValueChange = (rawValue: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    const currentInput = valueInputRef.current
    if (currentInput && /^[/\\]/.test(rawValue)) {
      const lastSep = Math.max(
        rawValue.lastIndexOf("/"),
        rawValue.lastIndexOf("\\"),
      )
      const parentPath =
        lastSep <= 0
          ? rawValue
          : rawValue.slice(0, lastSep) || "/"
      const query = /[/\\]$/.test(rawValue)
        ? ""
        : rawValue.slice(lastSep + 1)
      debounceTimerRef.current = setTimeout(() => {
        const rect = currentInput.getBoundingClientRect()
        setPathPickerState({
          inputElement: currentInput,
          target: {
            mode: "pathVar",
            pathVarId: pathVar.id,
          },
          parentPath,
          query,
          triggerRect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
          entries: null,
          error: null,
          activeIndex: 0,
          matches: null,
          separator: "/",
          cachedParentPath: null,
          requestToken: 0,
          debounceTimerId: null,
        })
      }, 250)
    } else {
      setPathPickerState(null)
    }
  }

  return (
    <div
      data-path-var={pathVar.id}
      className="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={handleBrowse}
          title={
            pathVar.value
              ? "Browse files in this folder"
              : "Browse to pick a folder for this path variable"
          }
          aria-label={
            pathVar.value
              ? "Browse files in this folder"
              : "Pick a folder for this path variable"
          }
          className="text-xs text-slate-500 hover:text-slate-300 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 shrink-0"
        >
          📁
        </button>
        <input
          type="text"
          defaultValue={pathVar.label}
          data-action="set-path-label"
          data-pv-id={pathVar.id}
          onChange={(event) =>
            setLabel(event.currentTarget.value)
          }
          className="text-xs font-medium text-slate-300 bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
        />
        <span className="text-xs text-slate-600 font-mono shrink-0">
          path variable
        </span>
        {!isFirst && (
          <button
            type="button"
            onClick={removePath}
            title="Remove path variable"
            aria-label="Remove path variable"
            className="text-xs text-slate-500 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={valueInputRef}
        type="text"
        defaultValue={pathVar.value}
        placeholder="/mnt/media or D:\Media"
        data-action="set-path-value"
        data-pv-id={pathVar.id}
        onChange={(event) =>
          handleValueChange(event.currentTarget.value)
        }
        onBlur={(event) =>
          setValue(event.currentTarget.value)
        }
        className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}
