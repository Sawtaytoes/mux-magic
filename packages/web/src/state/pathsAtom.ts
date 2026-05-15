// Back-compat shim: pathsAtom is now a read-only view over variablesAtom.
// All write operations go through variablesAtom directly.
// Callers reading pathsAtom continue to work; migrate writes to variablesAtom over time.

import { atom } from "jotai"
import type { PathVariable } from "../types"
import {
  cancelVariableDeleteAtom,
  confirmVariableDeleteAtom,
  pendingVariableDeleteAtom,
  removeVariableAtom,
  setVariableResolutionAtom,
  variablesAtom,
} from "./variablesAtom"

export { variablesAtom }

// pathsAtom is a writable derived view: reads only path-typed variables, writes
// merge back into variablesAtom (replacing path variables, preserving others).
// This keeps all existing callers — store.set(pathsAtom, [...]) and
// useSetAtom(pathsAtom) — working without modification.
// The filters narrow to `PathVariable` via type predicates so downstream
// consumers (LinkPicker, runAtoms, yamlCodec) keep their existing
// `PathVariable[]` signatures. Worker 35 added the second variable type
// (`dvdCompareId`); without these predicates, TS widens to the full union
// and every path-only consumer would need a filter at the call site.
export const pathsAtom = atom(
  (get) =>
    get(variablesAtom).filter(
      (variable): variable is PathVariable =>
        variable.type === "path",
    ),
  (
    get,
    set,
    update:
      | PathVariable[]
      | ((prev: PathVariable[]) => PathVariable[]),
  ) => {
    const current = get(variablesAtom)
    const prevPaths = current.filter(
      (variable): variable is PathVariable =>
        variable.type === "path",
    )
    const newPaths = (
      typeof update === "function"
        ? update(prevPaths)
        : update
    ).map((pathVariable) => ({
      ...pathVariable,
      type: "path" as const,
    }))
    set(variablesAtom, [
      ...current.filter(
        (variable) => variable.type !== "path",
      ),
      ...newPaths,
    ])
  },
)

// ─── Back-compat write atoms ──────────────────────────────────────────────────
// These keep old call sites working without a full migration sweep.

export const addPathAtom = atom(null, (_get, set) => {
  set(variablesAtom, (variables) => [
    ...variables,
    {
      id: `pathVariable_${Math.random().toString(36).slice(2, 8)}`,
      label: "",
      value: "",
      type: "path" as const,
    },
  ])
})

export const addPathVariableAtom = atom(
  null,
  (
    _get,
    set,
    args: { id: string; label: string; value: string },
  ) => {
    set(variablesAtom, (variables) => [
      ...variables,
      {
        id: args.id,
        label: args.label,
        value: args.value,
        type: "path" as const,
      },
    ])
  },
)

export const setPathValueAtom = atom(
  null,
  (
    _get,
    set,
    args: { pathVariableId: string; value: string },
  ) => {
    set(variablesAtom, (variables) =>
      variables.map((variable) =>
        variable.id === args.pathVariableId
          ? { ...variable, value: args.value }
          : variable,
      ),
    )
  },
)

// ─── Delete-with-usage-scan (re-exported from variablesAtom) ──────────────────

// Re-export the pending-delete types for callers that import them from pathsAtom.
export type {
  PendingVariableDelete as PendingPathVariableDelete,
  VariableResolution as PathVariableResolution,
  VariableUsage as PathVariableUsage,
} from "./variablesAtom"

export const pendingPathVariableDeleteAtom =
  pendingVariableDeleteAtom

export const removePathVariableAtom = atom(
  null,
  (_get, set, pathVariableId: string) => {
    set(removeVariableAtom, pathVariableId)
  },
)

export const setPathVariableResolutionAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      stepId: string
      fieldName: string
      resolution:
        | { kind: "replace"; targetId: string }
        | { kind: "unlink" }
    },
  ) => {
    set(setVariableResolutionAtom, args)
  },
)

export const confirmPathVariableDeleteAtom = atom(
  null,
  (_get, set) => {
    set(confirmVariableDeleteAtom)
  },
)

export const cancelPathVariableDeleteAtom = atom(
  null,
  (_get, set) => {
    set(cancelVariableDeleteAtom)
  },
)
