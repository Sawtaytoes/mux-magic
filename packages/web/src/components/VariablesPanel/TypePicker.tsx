import { useAtomValue } from "jotai"
import { variablesAtom } from "../../state/variablesAtom"
import type { VariableType } from "../../types"
import { getVariableTypeDefinition } from "../VariableCard/registry"

const AVAILABLE_TYPES: VariableType[] = ["path"]

export const TypePicker = ({
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
      return !variables.some(
        (variable) => variable.type === type,
      )
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
