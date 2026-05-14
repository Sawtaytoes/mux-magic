import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import {
  addVariableAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { VariableType } from "../../types"
import { VariableCard } from "../VariableCard/VariableCard"
import { TypePicker } from "./TypePicker"

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
