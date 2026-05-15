import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import type { Commands } from "../commands/types"
import type { Step } from "../types"
import { commandsAtom } from "./commandsAtom"
import {
  changeCommandAtom,
  insertStepAtom,
} from "./stepAtoms"
import { stepsAtom } from "./stepsAtom"
import { variablesAtom } from "./variablesAtom"

// Minimal commands map: one command with a dvdCompareId field, one without.
const TEST_COMMANDS: Commands = {
  nameSpecialFeaturesDvdCompareTmdb: {
    fields: [
      { name: "sourcePath", type: "path" },
      {
        name: "dvdCompareId",
        type: "numberWithLookup",
        lookupType: "dvdcompare",
      },
    ],
  },
  makeDirectory: {
    fields: [{ name: "sourcePath", type: "path" }],
  },
}

const setupStore = () => {
  const store = createStore()
  store.set(commandsAtom, TEST_COMMANDS)
  store.set(stepsAtom, [])
  store.set(variablesAtom, [])
  const newStepId = store.set(insertStepAtom, { index: 0 })
  return { store, newStepId: newStepId as string }
}

describe("changeCommandAtom — dvdCompareId auto-create (worker 35)", () => {
  test("picking a command with dvdCompareId field auto-creates a dvdCompareId Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
    })

    const variables = store.get(variablesAtom)
    const dvdVars = variables.filter(
      (variable) => variable.type === "dvdCompareId",
    )
    expect(dvdVars).toHaveLength(1)
    expect(dvdVars[0].value).toBe("")
    expect(dvdVars[0].label).toBe("")
  })

  test("the step's dvdCompareId field is pre-linked to the new Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
    })

    const variables = store.get(variablesAtom)
    const dvdVar = variables.find(
      (variable) => variable.type === "dvdCompareId",
    )
    expect(dvdVar).toBeDefined()

    const step = store.get(stepsAtom)[0] as Step
    expect(step.links.dvdCompareId).toBe(dvdVar?.id)
  })

  test("picking a command without dvdCompareId field does NOT create a Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "makeDirectory",
    })

    expect(store.get(variablesAtom)).toHaveLength(0)
    const step = store.get(stepsAtom)[0] as Step
    expect(step.links.dvdCompareId).toBeUndefined()
  })

  test("two steps with the same dvdCompareId-bearing command get two separate Variables", () => {
    const { store, newStepId: firstId } = setupStore()
    const secondId = store.set(insertStepAtom, {
      index: 1,
    }) as string

    store.set(changeCommandAtom, {
      stepId: firstId,
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
    })
    store.set(changeCommandAtom, {
      stepId: secondId,
      commandName: "nameSpecialFeaturesDvdCompareTmdb",
    })

    const dvdVars = store
      .get(variablesAtom)
      .filter(
        (variable) => variable.type === "dvdCompareId",
      )
    expect(dvdVars).toHaveLength(2)
    expect(dvdVars[0].id).not.toBe(dvdVars[1].id)

    const steps = store.get(stepsAtom) as Step[]
    expect(steps[0].links.dvdCompareId).toBe(dvdVars[0].id)
    expect(steps[1].links.dvdCompareId).toBe(dvdVars[1].id)
  })
})
