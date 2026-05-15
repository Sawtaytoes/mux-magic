import { atom } from "jotai"
import { isGroup } from "../jobs/sequenceUtils"
import type { Group, Step } from "../types"
import { stepCounterAtom, stepsAtom } from "./stepsAtom"

// ─── Group CRUD ───────────────────────────────────────────────────────────────
// Atoms that mutate groups (top-level containers). Step-level operations
// inside groups live in stepAtoms.ts — those walk both top-level and
// in-group steps via a stepId.

export const toggleGroupCollapsedAtom = atom(
  null,
  (_get, set, groupId: string) => {
    set(stepsAtom, (items) =>
      items.map((item) =>
        isGroup(item) && item.id === groupId
          ? { ...item, isCollapsed: !item.isCollapsed }
          : item,
      ),
    )
  },
)

export const updateGroupLabelAtom = atom(
  null,
  (_get, set, args: { groupId: string; label: string }) => {
    set(stepsAtom, (items) =>
      items.map((item) =>
        isGroup(item) && item.id === args.groupId
          ? { ...item, label: args.label }
          : item,
      ),
    )
  },
)

export const setGroupChildrenCollapsedAtom = atom(
  null,
  (
    _get,
    set,
    args: { groupId: string; isCollapsed: boolean },
  ) => {
    set(stepsAtom, (items) =>
      items.map((item) => {
        if (!isGroup(item) || item.id !== args.groupId)
          return item
        return {
          ...item,
          steps: item.steps.map((step) => ({
            ...step,
            isCollapsed: args.isCollapsed,
          })),
        }
      }),
    )
  },
)

export const moveGroupAtom = atom(
  null,
  (
    _get,
    set,
    args: { groupId: string; direction: -1 | 1 },
  ) => {
    set(stepsAtom, (items) => {
      const arr = [...items]
      const idx = arr.findIndex(
        (item) => isGroup(item) && item.id === args.groupId,
      )
      const next = idx + args.direction
      if (idx < 0 || next < 0 || next >= arr.length)
        return items
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  },
)

export const removeGroupAtom = atom(
  null,
  (_get, set, groupId: string) => {
    set(stepsAtom, (items) =>
      items.filter(
        (item) => !(isGroup(item) && item.id === groupId),
      ),
    )
  },
)

export const insertGroupAtom = atom(
  null,
  (
    get,
    set,
    args: { index: number; isParallel: boolean },
  ) => {
    const counter = get(stepCounterAtom)
    const newStep: Step = {
      id: `step${counter + 1}`,
      alias: "",
      command: "",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const newGroup: Group = {
      kind: "group",
      id: `group_${Math.random().toString(36).slice(2, 8)}`,
      label: "",
      isParallel: args.isParallel,
      isCollapsed: false,
      steps: [newStep],
    }
    set(stepCounterAtom, counter + 1)
    set(stepsAtom, (items) => {
      const arr = [...items]
      arr.splice(args.index, 0, newGroup)
      return arr
    })
    return newStep.id
  },
)
