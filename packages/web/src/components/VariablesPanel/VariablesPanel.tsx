import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import {
  getVariableTypeDefinition,
} from "../VariableCard/registry"
import { VariableCard } from "../VariableCard/VariableCard"
import {
  addVariableAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { VariableType } from "../../types"

// ─── Type picker ──────────────────────────────────────────────────────────────

const AVAILABLE_TYPES: VariableType[] = ["path"]

const TypePicker = ({
  onPick,
  onCancel,
}: {
  onPick: (type: VariableType) => void
  onCancel: () => void
}) => {
  const variables = useAtomValue(variablesAtom)

  const availableTypes = AVAILABLE_TYPES.filter((type) => {
    const definition = getVariableTypeDefinition(type)
    if (!definition) return false
    if (definition.cardinality === "singleton") {
      return !variables.some((variable) => variable.type === type)
    }
    return true
  })

  return (
    <div
      role="menu"
      aria-label="Variable type picker"
      className="flex flex-col gap-1 mt-2 p-2 bg-slate-800 rounded-lg border border-slate-600"
    >
      <p className="text-xs text-slate-400 mb-1">
        Choose a variable type:
      </p>
      {availableTypes.map((type) => {
        const definition = getVariableTypeDefinition(type)
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="text-xs text-left px-3 py-1.5 rounded hover:bg-slate-700 text-slate-200"
          >
            {definition?.label ?? type}
          </button>
        )
      })}
      {availableTypes.length === 0 && (
        <p className="text-xs text-slate-500 px-3 py-1.5">
          All variable types are already added.
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1 mt-1 border-t border-slate-700"
      >
        Cancel
      </button>
    </div>
  )
}

// ─── VariablesPanel ───────────────────────────────────────────────────────────

export const VariablesPanel = () => {
  const variables = useAtomValue(variablesAtom)
  const addVariable = useSetAtom(addVariableAtom)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const handlePick = (type: VariableType) => {
    addVariable({ type })
    setIsPickerOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {variables.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No variables defined yet.
        </p>
      )}

      {variables.map((variable, index) => (
        <VariableCard
          key={variable.id}
          variable={variable}
          isFirst={index === 0}
        />
      ))}

      {isPickerOpen ? (
        <TypePicker
          onPick={handlePick}
          onCancel={() => setIsPickerOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          aria-label="Add variable"
          className="self-start text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-dashed border-slate-700 hover:border-slate-500 transition-colors"
        >
          + Add Variable
        </button>
      )}
    </div>
  )
}
