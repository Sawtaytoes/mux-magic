import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import { apiBase } from "../../apiBase"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import {
  cancelVariableDeleteAtom,
  confirmVariableDeleteAtom,
  pendingVariableDeleteAtom,
  removeVariableAtom,
  setVariableResolutionAtom,
  setVariableValueAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { PathValueInput } from "./PathValueInput"

interface VariableCardProps {
  variable: Variable
  isFirst: boolean
}

export const VariableCard = ({
  variable,
  isFirst,
}: VariableCardProps) => {
  const allVariables = useAtomValue(variablesAtom)
  const setValue = useSetAtom(setVariableValueAtom)
  const setVariables = useSetAtom(variablesAtom)
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const remove = useSetAtom(removeVariableAtom)
  const setResolution = useSetAtom(
    setVariableResolutionAtom,
  )
  const confirm = useSetAtom(confirmVariableDeleteAtom)
  const cancel = useSetAtom(cancelVariableDeleteAtom)
  const pending = useAtomValue(pendingVariableDeleteAtom)

  const valueInputRef = useRef<HTMLInputElement | null>(
    null,
  )

  const setLabel = (label: string) => {
    setVariables((variables) =>
      variables.map((existingVariable) =>
        existingVariable.id === variable.id
          ? { ...existingVariable, label }
          : existingVariable,
      ),
    )
  }

  const handleBrowse = async () => {
    if (variable.value) {
      setFileExplorer({
        path: variable.value,
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
          setValue({
            variableId: variable.id,
            value: selectedPath,
          })
        },
      })
    }
  }

  const isPendingDelete =
    pending !== null && pending.variableId === variable.id
  const otherVariables = allVariables.filter(
    (otherVariable) =>
      otherVariable.id !== variable.id &&
      otherVariable.type === variable.type,
  )

  return (
    <div
      data-path-var={variable.id}
      className="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        {variable.type === "path" && (
          <button
            type="button"
            onClick={handleBrowse}
            title={
              variable.value
                ? "Browse files in this folder"
                : "Browse to pick a folder for this path variable"
            }
            aria-label={
              variable.value
                ? "Browse files in this folder"
                : "Pick a folder for this path variable"
            }
            className="text-xs text-slate-500 hover:text-slate-300 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 shrink-0"
          >
            📁
          </button>
        )}
        <input
          type="text"
          defaultValue={variable.label}
          data-action="set-path-label"
          data-pv-id={variable.id}
          onChange={(event) =>
            setLabel(event.currentTarget.value)
          }
          className="text-xs font-medium text-slate-300 bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
        />
        <span className="text-xs text-slate-600 font-mono shrink-0">
          {variable.type} variable
        </span>
        {!isFirst && (
          <button
            type="button"
            onClick={() => remove(variable.id)}
            title="Remove path variable"
            aria-label="Remove path variable"
            className="text-xs text-slate-500 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700"
          >
            ✕
          </button>
        )}
      </div>
      {variable.type === "path" && (
        <PathValueInput
          variable={variable}
          valueInputRef={valueInputRef}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {isPendingDelete && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-xs"
        >
          <p className="text-amber-300 font-medium mb-2">
            This variable is used by the following fields.
            Choose what to do with each:
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
                  {otherVariables.map((otherVariable) => (
                    <option
                      key={otherVariable.id}
                      value={otherVariable.id}
                    >
                      Replace with: {otherVariable.label}
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

