import { atom } from "jotai"
import {
  flattenSteps,
  isGroup,
} from "../jobs/sequenceUtils"
import type {
  PathVariable,
  SequenceItem,
  Step,
} from "../types"
import { stepsAtom } from "./stepsAtom"

export const pathsAtom = atom<PathVariable[]>([])

export type PathVariableUsage = {
  stepId: string
  fieldName: string
}

export type PathVariableResolution =
  | { kind: "replace"; targetId: string }
  | { kind: "unlink" }

export type PendingPathVariableDelete = {
  pathVariableId: string
  pathVariableValue: string
  usages: PathVariableUsage[]
  resolutions: Record<string, PathVariableResolution>
}

export const pendingPathVariableDeleteAtom =
  atom<PendingPathVariableDelete | null>(null)

const usageKey = (stepId: string, fieldName: string) =>
  `${stepId}:${fieldName}`

export const removePathVariableAtom = atom(
  null,
  (get, set, pathVariableId: string) => {
    const paths = get(pathsAtom)
    const steps = get(stepsAtom)
    const pathVariable = paths.find(
      (pv) => pv.id === pathVariableId,
    )
    if (!pathVariable) return

    const usages: PathVariableUsage[] = []
    for (const { step } of flattenSteps(steps)) {
      for (const [fieldName, link] of Object.entries(
        step.links,
      )) {
        if (
          typeof link === "string" &&
          link === pathVariableId
        ) {
          usages.push({ stepId: step.id, fieldName })
        }
      }
    }

    if (usages.length === 0) {
      set(
        pathsAtom,
        paths.filter((pv) => pv.id !== pathVariableId),
      )
      return
    }

    const resolutions: Record<
      string,
      PathVariableResolution
    > = {}
    for (const { stepId, fieldName } of usages) {
      resolutions[usageKey(stepId, fieldName)] = {
        kind: "unlink",
      }
    }

    set(pendingPathVariableDeleteAtom, {
      pathVariableId,
      pathVariableValue: pathVariable.value,
      usages,
      resolutions,
    })
  },
)

export const setPathVariableResolutionAtom = atom(
  null,
  (
    get,
    set,
    args: {
      stepId: string
      fieldName: string
      resolution: PathVariableResolution
    },
  ) => {
    const pending = get(pendingPathVariableDeleteAtom)
    if (!pending) return
    set(pendingPathVariableDeleteAtom, {
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
  usages: PathVariableUsage[],
  resolutions: Record<string, PathVariableResolution>,
  pathVariableValue: string,
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
      params[fieldName] = pathVariableValue
    }
  }

  return { ...step, links, params }
}

export const confirmPathVariableDeleteAtom = atom(
  null,
  (get, set) => {
    const pending = get(pendingPathVariableDeleteAtom)
    if (!pending) return

    const {
      pathVariableId,
      pathVariableValue,
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
                pathVariableValue,
              ),
            ),
          }
        }
        return applyResolutionsToStep(
          item as Step,
          usages,
          resolutions,
          pathVariableValue,
        )
      }),
    )

    set(pathsAtom, (paths) =>
      paths.filter((pv) => pv.id !== pathVariableId),
    )
    set(pendingPathVariableDeleteAtom, null)
  },
)

export const cancelPathVariableDeleteAtom = atom(
  null,
  (_get, set) => {
    set(pendingPathVariableDeleteAtom, null)
  },
)
