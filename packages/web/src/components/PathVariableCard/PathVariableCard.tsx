import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { apiBase } from "../../apiBase"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import {
  cancelPathVariableDeleteAtom,
  confirmPathVariableDeleteAtom,
  pathsAtom,
  pendingPathVariableDeleteAtom,
  removePathVariableAtom,
  setPathVariableResolutionAtom,
} from "../../state/pathsAtom"
import { pathPickerStateAtom } from "../../state/pickerAtoms"
import type { PathVariable } from "../../types"

interface PathVariableCardProps {
  pathVariable: PathVariable
  isFirst: boolean
}

export const PathVariableCard = ({
  pathVariable,
  isFirst,
}: PathVariableCardProps) => {
  const allPaths = useAtomValue(pathsAtom)
  const setPaths = useSetAtom(pathsAtom)
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const setPathPickerState = useSetAtom(pathPickerStateAtom)
  const removePath = useSetAtom(removePathVariableAtom)
  const setResolution = useSetAtom(
    setPathVariableResolutionAtom,
  )
  const confirm = useSetAtom(confirmPathVariableDeleteAtom)
  const cancel = useSetAtom(cancelPathVariableDeleteAtom)
  const pending = useAtomValue(
    pendingPathVariableDeleteAtom,
  )

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
        path.id === pathVariable.id
          ? { ...path, label }
          : path,
      ),
    )
  }

  const setValue = (value: string) => {
    setPaths((paths) =>
      paths.map((path) =>
        path.id === pathVariable.id
          ? { ...path, value }
          : path,
      ),
    )
  }

  const handleBrowse = async () => {
    if (pathVariable.value) {
      setFileExplorer({
        path: pathVariable.value,
        pickerOnSelect: null,
      })
    } else {
      let startPath = "/"
      try {
        const response = await fetch(
          `${apiBase}/files/default-path`,
        )
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
    // Open the path picker when the input looks like a path: starts with
    // / or \ (POSIX / UNC) OR a Windows drive letter prefix like `C:\`.
    // PathField uses the same regex — PathVariableCard was missing the drive
    // letter branch, which is why typeahead never opened on Windows.
    if (
      currentInput &&
      /^([/\\]|[A-Za-z]:[/\\])/.test(rawValue)
    ) {
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
            mode: "pathVariable",
            pathVariableId: pathVariable.id,
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

  const isPendingDelete =
    pending !== null &&
    pending.pathVariableId === pathVariable.id
  const otherPaths = allPaths.filter(
    (pv) => pv.id !== pathVariable.id,
  )

  return (
    <div
      data-path-var={pathVariable.id}
      className="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={handleBrowse}
          title={
            pathVariable.value
              ? "Browse files in this folder"
              : "Browse to pick a folder for this path variable"
          }
          aria-label={
            pathVariable.value
              ? "Browse files in this folder"
              : "Pick a folder for this path variable"
          }
          className="text-xs text-slate-500 hover:text-slate-300 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 shrink-0"
        >
          📁
        </button>
        <input
          type="text"
          defaultValue={pathVariable.label}
          data-action="set-path-label"
          data-pv-id={pathVariable.id}
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
            onClick={() => removePath(pathVariable.id)}
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
        value={pathVariable.value}
        placeholder="/mnt/media or D:\Media"
        data-action="set-path-value"
        data-pv-id={pathVariable.id}
        onChange={(event) => {
          // Controlled input: commit every keystroke to pathsAtom so
          // any field linked to this variable re-renders live. The
          // previous defaultValue + onBlur committed once on blur,
          // which meant external updates (e.g. typing in a linked
          // PathField in a step card) never re-painted this input —
          // the value only refreshed on a full page reload.
          setValue(event.currentTarget.value)
          handleValueChange(event.currentTarget.value)
        }}
        className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      {isPendingDelete && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-xs"
        >
          <p className="text-amber-300 font-medium mb-2">
            This path variable is used by the following
            fields. Choose what to do with each:
          </p>
          <div className="flex flex-col gap-2">
            {pending.usages.map(({ stepId, fieldName }) => (
              <div
                key={`${stepId}:${fieldName}`}
                className="flex items-center gap-2"
              >
                <span className="text-slate-400 font-mono shrink-0">
                  {stepId} → {fieldName}
                </span>
                <select
                  aria-label={`Resolution for ${stepId} ${fieldName}`}
                  className="ml-auto bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
                  defaultValue="unlink"
                  onChange={(event) => {
                    const val = event.currentTarget.value
                    setResolution({
                      stepId,
                      fieldName,
                      resolution:
                        val === "unlink"
                          ? { kind: "unlink" }
                          : {
                              kind: "replace",
                              targetId: val,
                            },
                    })
                  }}
                >
                  <option value="unlink">
                    Unlink (use literal value)
                  </option>
                  {otherPaths.map((pv) => (
                    <option key={pv.id} value={pv.id}>
                      Replace with: {pv.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => confirm()}
              className="text-xs bg-red-700 hover:bg-red-600 text-white rounded px-3 py-1"
            >
              Delete and apply
            </button>
            <button
              type="button"
              onClick={() => cancel()}
              className="text-xs text-slate-400 hover:text-slate-200 rounded px-3 py-1 border border-slate-600 hover:border-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
