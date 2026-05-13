import yaml from "js-yaml"
import { describe, expect, test } from "vitest"
import type { Commands } from "../commands/types"
import type {
  PathVariable,
  SequenceItem,
  Step,
  Variable,
} from "../types"
import { toYamlStr } from "./yamlSerializer"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step-1",
  alias: "",
  command: "makeDirectory",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const BASE_PATH: PathVariable = {
  id: "basePath",
  label: "Base Path",
  value: "/fixture/media",
}

const MAKE_DIR_COMMAND: Commands = {
  makeDirectory: {
    fields: [
      {
        name: "filePath",
        type: "path",
        label: "Directory Path",
        isRequired: true,
      },
    ],
  },
}

// ─── Empty / sentinel cases ───────────────────────────────────────────────────

describe("toYamlStr — empty states", () => {
  test("returns sentinel when steps is empty and no path values set", () => {
    const paths: PathVariable[] = [
      { id: "basePath", label: "Base Path", value: "" },
    ]
    expect(toYamlStr([], paths, {})).toBe("# No steps yet")
  })

  test("returns sentinel when steps list is empty", () => {
    expect(toYamlStr([], [], {})).toBe("# No steps yet")
  })
})

// ─── Link resolution through buildParams ─────────────────────────────────────

describe("toYamlStr — link resolution", () => {
  test("string link becomes @<id> in serialized params", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: { filePath: "basePath" },
    })
    const paths: PathVariable[] = [BASE_PATH]

    const result = toYamlStr(
      [step] as SequenceItem[],
      paths,
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("filePath: '@basePath'")
  })

  test("object link is serialized as linkedTo/output object", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: {
        filePath: {
          linkedTo: "prev-step",
          output: "folder",
        },
      },
    })
    const paths: PathVariable[] = [BASE_PATH]

    const result = toYamlStr(
      [step] as SequenceItem[],
      paths,
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("linkedTo: prev-step")
    expect(result).toContain("output: folder")
  })
})

// ─── Default-value omission via buildParams ───────────────────────────────────

describe("toYamlStr — buildParams default omission", () => {
  test("field at its default value is omitted from output", () => {
    const commands: Commands = {
      remuxToMkv: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
          },
          {
            name: "isRecursive",
            type: "boolean",
            default: false,
          },
        ],
      },
    }
    const step = makeStep({
      command: "remuxToMkv",
      params: { isRecursive: false },
      links: { sourcePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      commands,
    )

    expect(result).not.toContain("isRecursive")
  })

  test("field above its default value is included in output", () => {
    const commands: Commands = {
      remuxToMkv: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
          },
          {
            name: "isRecursive",
            type: "boolean",
            default: false,
          },
        ],
      },
    }
    const step = makeStep({
      command: "remuxToMkv",
      params: { isRecursive: true },
      links: { sourcePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      commands,
    )

    expect(result).toContain("isRecursive: true")
  })
})

// ─── Unknown command fallback ─────────────────────────────────────────────────

describe("toYamlStr — unknown command fallback", () => {
  test("falls back to raw step.params when command not in commands map", () => {
    const step = makeStep({
      command: "unknownCommand",
      params: { someField: "some-value" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      {},
    )

    expect(result).toContain("someField: some-value")
  })
})

// ─── Paths block (legacy — still passes, tests content not key name) ─────────

describe("toYamlStr — paths block", () => {
  test("path variable with value appears in output", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: { filePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("basePath:")
    expect(result).toContain("value: /fixture/media")
  })
})

// ─── variables: block (new format; these tests currently fail) ────────────────

describe("toYamlStr — variables: block output", () => {
  const PATH_VAR: Variable = {
    id: "basePath",
    label: "Base",
    value: "/mnt/media",
    type: "path",
  }

  test("writes variables: key, not paths:", () => {
    const result = toYamlStr([], [PATH_VAR], MAKE_DIR_COMMAND)
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    expect(parsed).toHaveProperty("variables")
    expect(parsed).not.toHaveProperty("paths")
  })

  test("each variable entry includes the type field", () => {
    const result = toYamlStr([], [PATH_VAR], MAKE_DIR_COMMAND)
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    const variablesObj = parsed.variables as Record<
      string,
      { type?: string }
    >
    expect(variablesObj.basePath?.type).toBe("path")
  })

  test("variable entry includes label and value", () => {
    const result = toYamlStr([], [PATH_VAR], MAKE_DIR_COMMAND)
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    const variablesObj = parsed.variables as Record<
      string,
      { label?: string; value?: string }
    >
    expect(variablesObj.basePath?.label).toBe("Base")
    expect(variablesObj.basePath?.value).toBe("/mnt/media")
  })
})

// ─── Blank step filtering ─────────────────────────────────────────────────────

describe("toYamlStr — blank step filtering", () => {
  test("omits blank steps (command: '') from a group's YAML", () => {
    const realStep = makeStep({
      id: "real-1",
      command: "makeDirectory",
    })
    const blankStep = makeStep({
      id: "blank-1",
      command: "",
    })
    const group: SequenceItem = {
      kind: "group",
      id: "group-1",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [realStep, blankStep],
    }

    const result = toYamlStr([group], [], MAKE_DIR_COMMAND)

    expect(result).toContain("real-1")
    expect(result).not.toContain("blank-1")
  })

  test("omits a standalone blank top-level step from the sequence", () => {
    const blankStep = makeStep({
      id: "blank-2",
      command: "",
    })
    const realStep = makeStep({
      id: "real-2",
      command: "makeDirectory",
    })

    const result = toYamlStr(
      [blankStep, realStep] as SequenceItem[],
      [],
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("real-2")
    expect(result).not.toContain("blank-2")
  })

  test("returns sentinel when a group contains only blank steps", () => {
    const group: SequenceItem = {
      kind: "group",
      id: "group-2",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [
        makeStep({ id: "blank-3", command: "" }),
        makeStep({ id: "blank-4", command: "" }),
      ],
    }

    const result = toYamlStr(
      [group],
      [{ id: "basePath", label: "Base Path", value: "" }],
      {},
    )

    expect(result).toBe("# No steps yet")
  })
})
