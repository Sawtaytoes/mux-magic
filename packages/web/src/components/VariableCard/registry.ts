import type { JSX } from "react"
import type { Variable, VariableType } from "../../types"

export type VariableTypeDefinition<
  T extends VariableType = VariableType,
> = {
  type: T
  label: string
  cardinality: "singleton" | "multi"
  defaultValue?: () => Promise<string> | string
  validate?: (value: string) => { isValid: boolean; message?: string }
  renderValueInput: (
    variable: Variable<T>,
    onChange: (value: string) => void,
  ) => JSX.Element
  isLinkable: boolean
}

const registry = new Map<
  VariableType,
  VariableTypeDefinition<VariableType>
>()

export const registerVariableType = <T extends VariableType>(
  definition: VariableTypeDefinition<T>,
): void => {
  registry.set(
    definition.type,
    definition as VariableTypeDefinition<VariableType>,
  )
}

export const getVariableTypeDefinition = (
  type: string,
): VariableTypeDefinition<VariableType> | undefined =>
  registry.get(type as VariableType)

// ─── Register built-in types ──────────────────────────────────────────────────

// The path type is the baseline; workers 11 and 35 register additional types.
// renderValueInput is handled by VariableCard dispatching on type — the registry
// entry here is for cardinality, isLinkable, and metadata only. A full
// renderValueInput is wired in VariableCard.tsx.
registerVariableType({
  type: "path",
  label: "Path",
  cardinality: "multi",
  isLinkable: true,
  renderValueInput: () => {
    throw new Error(
      "path renderValueInput is wired in VariableCard.tsx",
    )
  },
})
