import { atom } from "jotai"
import { isGroup } from "../jobs/sequenceUtils"
import type { SequenceItem, Step, StepLink } from "../types"
import { commandsAtom } from "./commandsAtom"
import {
  collectExistingIds,
  makeStepId,
} from "./idAllocator"
import { stepsAtom } from "./stepsAtom"
import { variablesAtom } from "./variablesAtom"

// ─── Step CRUD ────────────────────────────────────────────────────────────────
// Atoms that mutate individual steps. A step can live at the top level
// of the sequence or inside a group — every helper here walks both
// places so a stepId is all the caller needs.

export const toggleStepCollapsedAtom = atom(
  null,
  (_get, set, stepId: string) => {
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (!isGroup(item)) {
          return item.id === stepId
            ? { ...item, isCollapsed: !item.isCollapsed }
            : item
        }
        return {
          ...item,
          steps: item.steps.map((step) =>
            step.id === stepId
              ? { ...step, isCollapsed: !step.isCollapsed }
              : step,
          ),
        }
      }),
    )
  },
)

export const updateStepAliasAtom = atom(
  null,
  (_get, set, args: { stepId: string; alias: string }) => {
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (!isGroup(item)) {
          return item.id === args.stepId
            ? { ...item, alias: args.alias }
            : item
        }
        return {
          ...item,
          steps: item.steps.map((step) =>
            step.id === args.stepId
              ? { ...step, alias: args.alias }
              : step,
          ),
        }
      }),
    )
  },
)

export const moveStepAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      stepId: string
      direction: -1 | 1
      parentGroupId?: string | null
    },
  ) => {
    set(stepsAtom, (items) => {
      if (args.parentGroupId) {
        return items.map((item) => {
          if (
            !isGroup(item) ||
            item.id !== args.parentGroupId
          )
            return item
          const siblings = [...item.steps]
          const idx = siblings.findIndex(
            (step) => step.id === args.stepId,
          )
          const next = idx + args.direction
          if (
            idx < 0 ||
            next < 0 ||
            next >= siblings.length
          )
            return item
          ;[siblings[idx], siblings[next]] = [
            siblings[next],
            siblings[idx],
          ]
          return { ...item, steps: siblings }
        })
      }
      const top = [...items]
      const idx = top.findIndex(
        (item) =>
          !isGroup(item) &&
          (item as Step).id === args.stepId,
      )
      const next = idx + args.direction
      if (idx < 0 || next < 0 || next >= top.length)
        return items
      ;[top[idx], top[next]] = [top[next], top[idx]]
      return top
    })
  },
)

export const removeStepAtom = atom(
  null,
  (_get, set, stepId: string) => {
    set(stepsAtom, (items) => {
      const filtered = items.filter(
        (item) =>
          !(!isGroup(item) && (item as Step).id === stepId),
      )
      return filtered
        .map((item) => {
          if (!isGroup(item)) return item
          const steps = item.steps.filter(
            (step) => step.id !== stepId,
          )
          // Drop empty groups matching removeStep's legacy behaviour.
          if (steps.length === 0) return null
          return { ...item, steps }
        })
        .filter(Boolean) as SequenceItem[]
    })
  },
)

const blankStep = (id: string): Step => ({
  id,
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

export const insertStepAtom = atom(
  null,
  (
    get,
    set,
    args: { index: number; parentGroupId?: string | null },
  ) => {
    const newStep = blankStep(
      makeStepId(collectExistingIds(get(stepsAtom))),
    )
    set(stepsAtom, (items) => {
      if (args.parentGroupId) {
        return items.map((item) => {
          if (
            !isGroup(item) ||
            item.id !== args.parentGroupId
          )
            return item
          const steps = [...item.steps]
          steps.splice(args.index, 0, newStep)
          return { ...item, steps }
        })
      }
      const arr = [...items]
      arr.splice(args.index, 0, newStep)
      return arr
    })
    return newStep.id
  },
)

export const addStepToGroupAtom = atom(
  null,
  (get, set, groupId: string) => {
    const newStep = blankStep(
      makeStepId(collectExistingIds(get(stepsAtom))),
    )
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (!isGroup(item) || item.id !== groupId)
          return item
        return { ...item, steps: [...item.steps, newStep] }
      }),
    )
    return newStep.id
  },
)

// Returns a fresh dvdCompareId Variable id IF the named command has a
// `dvdCompareId` field; otherwise null. Side-effect: appends the new
// variable to variablesAtom. Worker 35: removes the manual "+ Add
// Variable" click when a user picks a command that needs one — the
// variable appears in the Variables panel and the step links to it.
const ensureDvdCompareIdVariable = (
  get: <T>(atomToRead: import("jotai").Atom<T>) => T,
  set: <Value, Args extends unknown[], Result>(
    writableAtom: import("jotai").WritableAtom<
      Value,
      Args,
      Result
    >,
    ...args: Args
  ) => Result,
  commandName: string,
): string | null => {
  const commands = get(commandsAtom)
  const commandDefinition = commands[commandName]
  if (!commandDefinition) return null
  const hasDvdCompareIdField =
    commandDefinition.fields.some(
      (field) => field.name === "dvdCompareId",
    )
  if (!hasDvdCompareIdField) return null

  const existing = get(variablesAtom)
  const newId = `dvdCompareIdVariable_${Math.random().toString(36).slice(2, 8)}`
  set(variablesAtom, [
    ...existing,
    {
      id: newId,
      label: "",
      value: "",
      type: "dvdCompareId",
    },
  ])
  return newId
}

export const changeCommandAtom = atom(
  null,
  (
    get,
    set,
    args: { stepId: string; commandName: string },
  ) => {
    const autoLinkVarId = ensureDvdCompareIdVariable(
      get,
      set,
      args.commandName,
    )
    const autoLinks: Record<string, StepLink> =
      autoLinkVarId ? { dvdCompareId: autoLinkVarId } : {}
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (!isGroup(item)) {
          if (item.id !== args.stepId) return item
          return {
            ...item,
            command: args.commandName,
            params: {},
            links: autoLinks,
          }
        }
        return {
          ...item,
          steps: item.steps.map((step) =>
            step.id === args.stepId
              ? {
                  ...step,
                  command: args.commandName,
                  params: {},
                  links: autoLinks,
                }
              : step,
          ),
        }
      }),
    )
  },
)

export const setParamAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      stepId: string
      fieldName: string
      value: unknown
    },
  ) => {
    const patch = (step: Step): Step => {
      if (step.id !== args.stepId) return step
      const params = { ...step.params }
      if (args.value === undefined) {
        delete params[args.fieldName]
      } else {
        params[args.fieldName] = args.value
      }
      return { ...step, params }
    }
    set(stepsAtom, (items) =>
      items.map((item) =>
        isGroup(item)
          ? { ...item, steps: item.steps.map(patch) }
          : patch(item as Step),
      ),
    )
  },
)

export const setLinkAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      stepId: string
      fieldName: string
      value: StepLink | null
    },
  ) => {
    const patch = (step: Step): Step => {
      if (step.id !== args.stepId) return step
      const links = { ...step.links }
      if (args.value === null) {
        delete links[args.fieldName]
      } else {
        links[args.fieldName] = args.value
      }
      return { ...step, links }
    }
    set(stepsAtom, (items) =>
      items.map((item) =>
        isGroup(item)
          ? { ...item, steps: item.steps.map(patch) }
          : patch(item as Step),
      ),
    )
  },
)

export const setStepRunStatusAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      stepId: string
      status: string | null
      jobId?: string | null
      error?: string | null
      hasResults?: boolean | null
    },
  ) => {
    const patch = (step: Step): Step => {
      if (step.id !== args.stepId) return step
      return {
        ...step,
        status: args.status,
        ...(args.jobId !== undefined
          ? { jobId: args.jobId }
          : {}),
        ...(args.error !== undefined
          ? { error: args.error }
          : {}),
        ...(args.hasResults !== undefined
          ? { hasResults: args.hasResults }
          : {}),
      }
    }
    set(stepsAtom, (items) =>
      items.map((item) =>
        isGroup(item)
          ? { ...item, steps: item.steps.map(patch) }
          : patch(item as Step),
      ),
    )
  },
)
