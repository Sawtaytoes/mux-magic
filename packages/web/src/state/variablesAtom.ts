import { atom } from "jotai"
import {
  flattenSteps,
  isGroup,
} from "../jobs/sequenceUtils"
import type {
  SequenceItem,
  Step,
  Variable,
  VariableType,
} from "../types"
import { stepsAtom } from "./stepsAtom"

export const variablesAtom = atom<Variable[]>([])

// ─── Add / set ────────────────────────────────────────────────────────────────

export const addVariableAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      type: VariableType
      label?: string
      value?: string
    },
  ) => {
    set(variablesAtom, (variables) => [
      ...variables,
      {
        id: `${args.type}Variable_${Math.random().toString(36).slice(2, 8)}`,
        label: args.label ?? "",
        value: args.value ?? "",
        type: args.type,
      },
    ])
  },
)

export const setVariableValueAtom = atom(
  null,
  (
    _get,
    set,
    args: { variableId: string; value: string },
  ) => {
    set(variablesAtom, (variables) =>
      variables.map((variable) =>
        variable.id === args.variableId
          ? { ...variable, value: args.value }
          : variable,
      ),
    )
  },
)

// ─── Pending-delete state ─────────────────────────────────────────────────────

export type VariableUsage = {
  stepId: string
  fieldName: string
}

export type VariableResolution =
  | { kind: "replace"; targetId: string }
  | { kind: "unlink" }

export type PendingVariableDelete = {
  variableId: string
  variableValue: string
  usages: VariableUsage[]
  resolutions: Record<string, VariableResolution>
}

export const pendingVariableDeleteAtom =
  atom<PendingVariableDelete | null>(null)

const usageKey = (stepId: string, fieldName: string) =>
  `${stepId}:${fieldName}`

export const removeVariableAtom = atom(
  null,
  (get, set, variableId: string) => {
    const variables = get(variablesAtom)
    const steps = get(stepsAtom)
    const variable = variables.find(
      (existingVariable) =>
        existingVariable.id === variableId,
    )
    if (!variable) return

    const usages: VariableUsage[] = []
    for (const { step } of flattenSteps(steps)) {
      for (const [fieldName, link] of Object.entries(
        step.links,
      )) {
        if (
          typeof link === "string" &&
          link === variableId
        ) {
          usages.push({ stepId: step.id, fieldName })
        }
      }
    }

    if (usages.length === 0) {
      set(
        variablesAtom,
        variables.filter(
          (existingVariable) =>
            existingVariable.id !== variableId,
        ),
      )
      return
    }

    const resolutions: Record<string, VariableResolution> =
      {}
    for (const { stepId, fieldName } of usages) {
      resolutions[usageKey(stepId, fieldName)] = {
        kind: "unlink",
      }
    }

    set(pendingVariableDeleteAtom, {
      variableId,
      variableValue: variable.value,
      usages,
      resolutions,
    })
  },
)

export const setVariableResolutionAtom = atom(
  null,
  (
    get,
    set,
    args: {
      stepId: string
      fieldName: string
      resolution: VariableResolution
    },
  ) => {
    const pending = get(pendingVariableDeleteAtom)
    if (!pending) return
    set(pendingVariableDeleteAtom, {
      ...pending,
      resolutions: {
        ...pending.resolutions,
        [usageKey(args.stepId, args.fieldName)]:
          args.resolution,
      },
    })
  },
)

const applyResolutionsToStep = (
  step: Step,
  usages: VariableUsage[],
  resolutions: Record<string, VariableResolution>,
  variableValue: string,
): Step => {
  const stepUsages = usages.filter(
    (usage) => usage.stepId === step.id,
  )
  if (stepUsages.length === 0) return step

  const links = { ...step.links }
  const params = { ...step.params }

  for (const { fieldName } of stepUsages) {
    const resolution =
      resolutions[usageKey(step.id, fieldName)]
    if (resolution?.kind === "replace") {
      links[fieldName] = resolution.targetId
    } else {
      delete links[fieldName]
      params[fieldName] = variableValue
    }
  }

  return { ...step, links, params }
}

export const confirmVariableDeleteAtom = atom(
  null,
  (get, set) => {
    const pending = get(pendingVariableDeleteAtom)
    if (!pending) return

    const {
      variableId,
      variableValue,
      usages,
      resolutions,
    } = pending

    set(stepsAtom, (items: SequenceItem[]) =>
      items.map((item) => {
        if (isGroup(item)) {
          return {
            ...item,
            steps: item.steps.map((step) =>
              applyResolutionsToStep(
                step,
                usages,
                resolutions,
                variableValue,
              ),
            ),
          }
        }
        return applyResolutionsToStep(
          item as Step,
          usages,
          resolutions,
          variableValue,
        )
      }),
    )

    set(variablesAtom, (variables) =>
      variables.filter(
        (existingVariable) =>
          existingVariable.id !== variableId,
      ),
    )
    set(pendingVariableDeleteAtom, null)
  },
)

export const cancelVariableDeleteAtom = atom(
  null,
  (_get, set) => {
    set(pendingVariableDeleteAtom, null)
  },
)
