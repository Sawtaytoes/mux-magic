import type { VariableTypeDefinition } from "../../components/VariableCard/registry"

// Definition for the `dvdCompareId` variable type. registry.ts registers
// this; the input is rendered by VariableCard.tsx dispatching on type
// (renderValueInput here throws to keep callers honest).
//
// Multi-instance, named: a sequence might hold several DVD Compare IDs (one
// for a director's-cut release, another for theatrical). The user names
// each via the standard variable label field.
export const DVD_COMPARE_ID_VARIABLE_DEFINITION: VariableTypeDefinition<"dvdCompareId"> =
  {
    type: "dvdCompareId",
    label: "DVD Compare ID",
    cardinality: "multi",
    isLinkable: true,
    defaultValue: () => "",
    validate: (value) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return { isValid: false, message: "Required" }
      }
      const isUrl = /dvdcompare\.net/i.test(trimmed)
      const isSlugOrId = /^[a-z0-9-]+$/i.test(trimmed)
      if (!isUrl && !isSlugOrId) {
        return {
          isValid: false,
          message:
            "Looks like neither a DVD Compare slug/id nor a dvdcompare.net URL",
        }
      }
      return { isValid: true }
    },
    renderValueInput: () => {
      throw new Error(
        "dvdCompareId renderValueInput is wired in VariableCard.tsx",
      )
    },
  }
