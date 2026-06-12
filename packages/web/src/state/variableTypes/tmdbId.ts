import type { VariableTypeDefinition } from "../../components/VariableCard/registry"

// Definition for the `tmdbId` variable type. registry.ts registers
// this; the input is rendered by VariableCard.tsx dispatching on type.
//
// Multi-instance, named: a sequence might hold several TMDB IDs (one
// for the main feature, one for a special). The user names each via
// the standard variable label field.
export const TMDB_ID_VARIABLE_DEFINITION: VariableTypeDefinition<"tmdbId"> =
  {
    type: "tmdbId",
    label: "TMDB ID",
    cardinality: "multi",
    isLinkable: true,
    runtimeValueType: "number",
    defaultValue: () => "",
    validate: (value) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return { isValid: false, message: "Required" }
      }
      const isUrl = /themoviedb\.org/i.test(trimmed)
      const isNumeric = /^\d+$/.test(trimmed)
      if (!isUrl && !isNumeric) {
        return {
          isValid: false,
          message:
            "Must be a numeric TMDB ID or a themoviedb.org URL",
        }
      }
      return { isValid: true }
    },
    renderValueInput: () => {
      throw new Error(
        "tmdbId renderValueInput is wired in VariableCard.tsx",
      )
    },
  }
