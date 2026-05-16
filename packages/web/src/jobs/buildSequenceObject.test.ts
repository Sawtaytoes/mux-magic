import { describe, expect, test } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_A } from "../commands/__fixtures__/commands"
import type { Group, Step, Variable } from "../types"
import { buildSequenceObject } from "./yamlCodec"

const makeStep = (overrides: Partial<Step>): Step => ({
  id: "step1",
  alias: "",
  command: "flattenOutput",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const PATH_BASE: Variable = {
  id: "basePath",
  label: "basePath",
  value: "/media",
  type: "path",
}

describe("buildSequenceObject", () => {
  test("emits a variables block keyed by id when any path has a value", () => {
    const result = buildSequenceObject(
      [],
      [PATH_BASE],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(result.variables).toEqual({
      basePath: {
        label: "basePath",
        value: "/media",
        type: "path",
      },
    })
    expect(result.steps).toEqual([])
  })

  test("omits the variables block entirely when all paths are blank and no threadCount", () => {
    const blankPath: Variable = {
      id: "basePath",
      label: "basePath",
      value: "",
      type: "path",
    }
    const result = buildSequenceObject(
      [],
      [blankPath],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    // The current toYamlStr also includes blank-value path entries in the
    // variables block keyed by id — buildSequenceObject keeps that behavior
    // so the JSON shape exactly mirrors the YAML shape.
    expect(result.variables).toEqual({
      basePath: {
        label: "basePath",
        value: "",
        type: "path",
      },
    })
  })

  test("emits a tc threadCount entry when one lives in the variables array", () => {
    // Worker 28: threadCount is now a Variable in variablesAtom (singleton,
    // canonical id "tc"). It flows through the `paths` arg like every other
    // type — there is no longer a separate threadCount param on the encoder.
    const threadCountVariable: Variable = {
      id: "tc",
      label: "",
      value: "4",
      type: "threadCount",
    }
    const result = buildSequenceObject(
      [],
      [threadCountVariable],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(result.variables).toEqual({
      tc: { label: "", value: "4", type: "threadCount" },
    })
  })

  test("serializes a mixed sequence of bare steps and a group", () => {
    const realStep = makeStep({
      id: "real",
      command: "flattenOutput",
      params: { sourcePath: "/x" },
    })
    const group: Group = {
      kind: "group",
      id: "g1",
      label: "myGroup",
      isParallel: true,
      isCollapsed: false,
      steps: [
        makeStep({
          id: "innerA",
          command: "flattenOutput",
          params: { sourcePath: "/a" },
        }),
      ],
    }
    const result = buildSequenceObject(
      [realStep, group],
      [],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(result.steps).toHaveLength(2)
    expect(
      (result.steps[0] as { command: string }).command,
    ).toBe("flattenOutput")
    expect(
      (
        result.steps[1] as {
          kind: string
          isParallel: boolean
        }
      ).kind,
    ).toBe("group")
    expect(
      (result.steps[1] as { isParallel: boolean })
        .isParallel,
    ).toBe(true)
  })

  test("preserves blank placeholder steps with empty params", () => {
    const blankStep = makeStep({
      id: "blank_pad",
      command: "",
    })
    const result = buildSequenceObject(
      [blankStep],
      [],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(result.steps).toEqual([
      {
        id: "blank_pad",
        command: "",
        params: {},
      },
    ])
  })

  test("preserves alias on a step", () => {
    const aliasStep = makeStep({
      id: "step1",
      alias: "myAlias",
      command: "flattenOutput",
      params: { sourcePath: "/x" },
    })
    const result = buildSequenceObject(
      [aliasStep],
      [],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(
      (result.steps[0] as { alias: string }).alias,
    ).toBe("myAlias")
  })

  test("preserves isCollapsed flag on a step when set", () => {
    const collapsedStep = makeStep({
      id: "step1",
      command: "flattenOutput",
      params: { sourcePath: "/x" },
      isCollapsed: true,
    })
    const result = buildSequenceObject(
      [collapsedStep],
      [],
      FIXTURE_COMMANDS_BUNDLE_A,
    )
    expect(
      (result.steps[0] as { isCollapsed?: boolean })
        .isCollapsed,
    ).toBe(true)
  })
})
