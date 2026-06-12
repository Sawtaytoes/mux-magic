import type { JSX } from "react"
import { ANIDB_ID_VARIABLE_DEFINITION } from "../../state/variableTypes/anidbId"
import { DVD_COMPARE_ID_VARIABLE_DEFINITION } from "../../state/variableTypes/dvdCompareId"
import { MAL_ID_VARIABLE_DEFINITION } from "../../state/variableTypes/malId"
import { THREAD_COUNT_VARIABLE_DEFINITION } from "../../state/variableTypes/threadCount"
import { TMDB_ID_VARIABLE_DEFINITION } from "../../state/variableTypes/tmdbId"
import type { Variable, VariableType } from "../../types"

export type VariableTypeDefinition<
  T extends VariableType = VariableType,
> = {
  type: T
  label: string
  cardinality: "singleton" | "multi"
  defaultValue?: () => Promise<string> | string
  validate?: (value: string) => {
    isValid: boolean
    message?: string
  }
  renderValueInput: (
    variable: Variable<T>,
    onChange: (value: string) => void,
  ) => JSX.Element
  isLinkable: boolean
  // When the type is singleton and the on-disk YAML envelope expects a
  // specific id (e.g. `tc` for threadCount), the registration declares it
  // here so addVariableAtom can mint the canonical id deterministically
  // instead of a random `${type}Variable_${rand}` slug. Round-tripping a
  // template through the canonical id is what keeps already-saved YAML
  // loading unchanged.
  canonicalId?: string
  // Variables always store `.value` as a string. When a step field linked
  // to this variable expects a number (e.g. dvdCompareId / threadCount,
  // both backed by `z.number()` schemas), the @-resolver coerces with
  // Number(value). Omit (or "string") for path-typed variables where the
  // raw string IS the runtime value. Mirrored server-side by the small
  // numeric-types set in resolveSequenceParams.ts.
  runtimeValueType?: "string" | "number"
}

const registry = new Map<
  VariableType,
  VariableTypeDefinition<VariableType>
>()

export const registerVariableType = <
  T extends VariableType,
>(
  definition: VariableTypeDefinition<T>,
): void => {
  registry.set(
    definition.type,
    definition as unknown as VariableTypeDefinition<VariableType>,
  )
}

export const getVariableTypeDefinition = (
  type: string,
): VariableTypeDefinition<VariableType> | undefined =>
  registry.get(type as VariableType)

export const listVariableTypes = (): Array<
  VariableTypeDefinition<VariableType>
> => Array.from(registry.values())

// ─── Register built-in types ──────────────────────────────────────────────────

// The path type is the baseline; workers 28 and 35 register additional types.
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

// Worker 35: dvdCompareId. Future ID-style types (TMDB, AniDB, MAL) follow
// the same pattern — one DEFINITION constant per type file under
// `src/state/variableTypes/`, registered here so the registry stays the
// single bootstrap point.
registerVariableType(DVD_COMPARE_ID_VARIABLE_DEFINITION)

// Worker 28: threadCount. Singleton; canonicalId "tc" preserves the on-disk
// YAML envelope worker 11 introduced. The input is a numeric field rendered
// by VariableCard.tsx dispatching on type.
registerVariableType(THREAD_COUNT_VARIABLE_DEFINITION)

// Worker 45: tmdbId, anidbId, malId. All are multi-cardinality, isLinkable,
// runtimeValueType "number". One per step that uses the matching field name.
registerVariableType(TMDB_ID_VARIABLE_DEFINITION)
registerVariableType(ANIDB_ID_VARIABLE_DEFINITION)
registerVariableType(MAL_ID_VARIABLE_DEFINITION)
