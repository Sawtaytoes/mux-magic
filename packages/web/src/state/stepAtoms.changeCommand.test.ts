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

// Minimal commands map: one command with a dvdCompareId field, one without,
// plus commands for the three new linkable ID types (worker 45).
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
  // Worker 45: command with both dvdCompareId AND tmdbId fields.
  nameMovieCutsDvdCompareTmdb: {
    fields: [
      { name: "sourcePath", type: "path" },
      {
        name: "dvdCompareId",
        type: "numberWithLookup",
        lookupType: "dvdcompare",
      },
      {
        name: "tmdbId",
        type: "numberWithLookup",
        lookupType: "tmdb",
      },
    ],
  },
  nameAnimeEpisodes: {
    fields: [
      { name: "sourcePath", type: "path" },
      {
        name: "malId",
        type: "numberWithLookup",
        lookupType: "mal",
      },
    ],
  },
  nameAnimeEpisodesAniDB: {
    fields: [
      { name: "sourcePath", type: "path" },
      {
        name: "anidbId",
        type: "numberWithLookup",
        lookupType: "anidb",
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

// ─── Worker 45: generalized ensureLinkableIdVariables ────────────────────────

describe("changeCommandAtom — malId auto-create (worker 45)", () => {
  test("picking a command with malId field auto-creates a malId Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameAnimeEpisodes",
    })

    const variables = store.get(variablesAtom)
    const malVars = variables.filter(
      (variable) => variable.type === "malId",
    )
    expect(malVars).toHaveLength(1)
    expect(malVars[0].value).toBe("")
    expect(malVars[0].label).toBe("")
  })

  test("the step's malId field is pre-linked to the new Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameAnimeEpisodes",
    })

    const malVar = store
      .get(variablesAtom)
      .find((variable) => variable.type === "malId")
    expect(malVar).toBeDefined()

    const step = store.get(stepsAtom)[0] as Step
    expect(step.links.malId).toBe(malVar?.id)
  })
})

describe("changeCommandAtom — anidbId auto-create (worker 45)", () => {
  test("picking a command with anidbId field auto-creates an anidbId Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameAnimeEpisodesAniDB",
    })

    const variables = store.get(variablesAtom)
    const anidbVars = variables.filter(
      (variable) => variable.type === "anidbId",
    )
    expect(anidbVars).toHaveLength(1)
    expect(anidbVars[0].value).toBe("")
  })

  test("the step's anidbId field is pre-linked to the new Variable", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameAnimeEpisodesAniDB",
    })

    const anidbVar = store
      .get(variablesAtom)
      .find((variable) => variable.type === "anidbId")
    expect(anidbVar).toBeDefined()

    const step = store.get(stepsAtom)[0] as Step
    expect(step.links.anidbId).toBe(anidbVar?.id)
  })
})

describe("changeCommandAtom — tmdbId auto-create (worker 45)", () => {
  test("picking a command with BOTH dvdCompareId AND tmdbId fields auto-creates one Variable per field", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameMovieCutsDvdCompareTmdb",
    })

    const variables = store.get(variablesAtom)
    const dvdVars = variables.filter(
      (variable) => variable.type === "dvdCompareId",
    )
    const tmdbVars = variables.filter(
      (variable) => variable.type === "tmdbId",
    )
    expect(dvdVars).toHaveLength(1)
    expect(tmdbVars).toHaveLength(1)
    expect(dvdVars[0].id).not.toBe(tmdbVars[0].id)
  })

  test("the step's dvdCompareId AND tmdbId fields are both pre-linked", () => {
    const { store, newStepId } = setupStore()

    store.set(changeCommandAtom, {
      stepId: newStepId,
      commandName: "nameMovieCutsDvdCompareTmdb",
    })

    const variables = store.get(variablesAtom)
    const dvdVar = variables.find(
      (variable) => variable.type === "dvdCompareId",
    )
    const tmdbVar = variables.find(
      (variable) => variable.type === "tmdbId",
    )

    const step = store.get(stepsAtom)[0] as Step
    expect(step.links.dvdCompareId).toBe(dvdVar?.id)
    expect(step.links.tmdbId).toBe(tmdbVar?.id)
  })
})
