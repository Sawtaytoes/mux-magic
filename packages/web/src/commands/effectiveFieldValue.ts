import type { WritableAtom } from "jotai"
import { setVariableValueAtom } from "../state/variablesAtom"
import type { Step, Variable } from "../types"

// ─── Effective field value helpers ───────────────────────────────────────────
//
// A step field that is linked to a Variable (step.links[fieldName] is a
// string variable id) uses the variable's `.value` as its source of truth.
// An unlinked field uses step.params[fieldName]. These helpers centralize
// the read/write split so the same logic applies across all linkable field
// types (dvdCompareId, tmdbId, anidbId, malId, and future types).
//
// Only object-form links ({ linkedTo, output }) are step-output references,
// not variable references — those fall through to params unchanged.
//
// Usage (NumberWithLookupField):
//   const rawValue = getEffectiveValue(step, field.name, variables)
//   setEffectiveValue(store, step, field.name, nextValue)

// Minimal jotai store interface that setEffectiveValue needs.
// Using `useStore()` return type directly would import React — this
// subset is enough for pure unit tests.
type AtomStore = {
  set: <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ) => Result
}

// Returns the effective numeric value for a field:
//   • If the field has a string link (variable id), resolve the variable's
//     `.value` through Number(). Non-finite → undefined (display as empty).
//   • Otherwise fall through to step.params[fieldName] as-is.
//
// Returns `unknown` (not `number | undefined`) so callers that handle string
// values (e.g. dvdCompareId slugs in unlinked mode) aren't forced to cast.
export const getEffectiveValue = (
  step: Step,
  fieldName: string,
  variables: Variable[],
): unknown => {
  const link = step.links?.[fieldName]
  if (typeof link === "string") {
    const found = variables.find(
      (variable) => variable.id === link,
    )
    if (!found?.value) return undefined
    const parsed = Number(found.value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  // Object-form links and unlinked fields fall through to params.
  return step.params[fieldName]
}

// Writes `nextValue` to the correct destination:
//   • If the field is linked (string variable id), write to the variable
//     via setVariableValueAtom. Value is stringified; undefined → "".
//   • If the field is NOT linked, this function is a no-op — callers
//     handle the setParam write themselves (e.g. setLinkedOrParamValue in
//     useBuilderActions). This keeps the write contract symmetrical with
//     how useBuilderActions already separates linked vs. unlinked writes.
export const setEffectiveValue = (
  store: AtomStore,
  step: Step,
  fieldName: string,
  nextValue: unknown,
) => {
  const link = step.links?.[fieldName]
  if (typeof link !== "string") {
    return
  }
  const stringValue =
    nextValue === undefined || nextValue === null
      ? ""
      : String(nextValue)
  store.set(setVariableValueAtom, {
    variableId: link,
    value: stringValue,
  })
}
