import { atom } from "jotai"
import {
  flattenSteps,
  isGroup,
} from "../jobs/sequenceUtils"
import type { PathVar, SequenceItem, Step } from "../types"
import { stepsAtom } from "./stepsAtom"

export const pathsAtom = atom<PathVar[]>([])

export type PathVarUsage = {
  stepId: string
  fieldName: string
}

export type PathVarResolution =
  | { kind: "replace"; targetId: string }
  | { kind: "unlink" }

export type PendingPathVarDelete = {
  pathVarId: string
  pathVarValue: string
  usages: PathVarUsage[]
  resolutions: Record<string, PathVarResolution>
}

export const pendingPathVarDeleteAtom =
  atom<PendingPathVarDelete | null>(null)

const usageKey = (stepId: string, fieldName: string) =>
  `${stepId}:${fieldName}`

export const removePathVarAtom = atom(
  null,
  (get, set, pathVarId: string) => {
    const paths = get(pathsAtom)
    const steps = get(stepsAtom)
    const pathVar = paths.find((pv) => pv.id === pathVarId)
    if (!pathVar) return

    const usages: PathVarUsage[] = []
    for (const { step } of flattenSteps(steps)) {
      for (const [fieldName, link] of Object.entries(
        step.links,
      )) {
        if (
          typeof link === "string" &&
          link === pathVarId
        ) {
          usages.push({ stepId: step.id, fieldName })
        }
      }
    }

    if (usages.length === 0) {
      set(
        pathsAtom,
        paths.filter((pv) => pv.id !== pathVarId),
      )
      return
    }

    const resolutions: Record<string, PathVarResolution> =
      {}
    for (const { stepId, fieldName } of usages) {
      resolutions[usageKey(stepId, fieldName)] = {
        kind: "unlink",
      }
    }

    set(pendingPathVarDeleteAtom, {
      pathVarId,
      pathVarValue: pathVar.value,
      usages,
      resolutions,
    })
  },
)

export const setPathVarResolutionAtom = atom(
  null,
  (
    get,
    set,
    args: {
      stepId: string
      fieldName: string
      resolution: PathVarResolution
    },
  ) => {
    const pending = get(pendingPathVarDeleteAtom)
    if (!pending) return
    set(pendingPathVarDeleteAtom, {
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
  usages: PathVarUsage[],
  resolutions: Record<string, PathVarResolution>,
  pathVarValue: string,
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
      params[fieldName] = pathVarValue
    }
  }

  return { ...step, links, params }
}

export const confirmPathVarDeleteAtom = atom(
  null,
  (get, set) => {
    const pending = get(pendingPathVarDeleteAtom)
    if (!pending) return

    const { pathVarId, pathVarValue, usages, resolutions } =
      pending

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
                pathVarValue,
              ),
            ),
          }
        }
        return applyResolutionsToStep(
          item as Step,
          usages,
          resolutions,
          pathVarValue,
        )
      }),
    )

    set(pathsAtom, (paths) =>
      paths.filter((pv) => pv.id !== pathVarId),
    )
    set(pendingPathVarDeleteAtom, null)
  },
)

export const cancelPathVarDeleteAtom = atom(
  null,
  (_get, set) => {
    set(pendingPathVarDeleteAtom, null)
  },
)
