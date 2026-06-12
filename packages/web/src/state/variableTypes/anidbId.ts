import type { VariableTypeDefinition } from "../../components/VariableCard/registry"

// Definition for the `anidbId` variable type. registry.ts registers
// this; the input is rendered by VariableCard.tsx dispatching on type.
//
// Multi-instance, named: a sequence might hold several AniDB IDs.
// The user names each via the standard variable label field.
export const ANIDB_ID_VARIABLE_DEFINITION: VariableTypeDefinition<"anidbId"> =
  {
    type: "anidbId",
    label: "AniDB ID",
    cardinality: "multi",
    isLinkable: true,
    runtimeValueType: "number",
    defaultValue: () => "",
    validate: (value) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return { isValid: false, message: "Required" }
      }
      const isUrl = /anidb\.net/i.test(trimmed)
      const isNumeric = /^\d+$/.test(trimmed)
      if (!isUrl && !isNumeric) {
        return {
          isValid: false,
          message:
            "Must be a numeric AniDB ID or an anidb.net URL",
        }
      }
      return { isValid: true }
    },
    renderValueInput: () => {
      throw new Error(
        "anidbId renderValueInput is wired in VariableCard.tsx",
      )
    },
  }
