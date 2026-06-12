import type { VariableTypeDefinition } from "../../components/VariableCard/registry"

// Definition for the `malId` variable type. registry.ts registers
// this; the input is rendered by VariableCard.tsx dispatching on type.
//
// Multi-instance, named: a sequence might hold several MAL IDs.
// The user names each via the standard variable label field.
export const MAL_ID_VARIABLE_DEFINITION: VariableTypeDefinition<"malId"> =
  {
    type: "malId",
    label: "MAL ID",
    cardinality: "multi",
    isLinkable: true,
    runtimeValueType: "number",
    defaultValue: () => "",
    validate: (value) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return { isValid: false, message: "Required" }
      }
      const isUrl = /myanimelist\.net/i.test(trimmed)
      const isNumeric = /^\d+$/.test(trimmed)
      if (!isUrl && !isNumeric) {
        return {
          isValid: false,
          message:
            "Must be a numeric MAL ID or a myanimelist.net URL",
        }
      }
      return { isValid: true }
    },
    renderValueInput: () => {
      throw new Error(
        "malId renderValueInput is wired in VariableCard.tsx",
      )
    },
  }
