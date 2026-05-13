import { describe, expect, test } from "vitest"
import type { Commands } from "../commands/types"
import type {
  PathVariable,
  SequenceItem,
  Step,
} from "../types"
import { loadYamlFromText, toYamlStr } from "./yamlCodec"

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

const BASE_PATHS: PathVariable[] = [
  { id: "basePath", label: "basePath", value: "" },
]

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

const FAKE_COMMANDS: Commands = {
  makeDirectory: {
    fields: [
      { name: "path", type: "path", isLinkable: true },
    ],
  },
  copyFiles: {
    fields: [
      { name: "source", type: "path", isLinkable: true },
      { name: "dest", type: "path", isLinkable: true },
    ],
  },
}

const load = (text: string) =>
  loadYamlFromText(text, FAKE_COMMANDS, BASE_PATHS, 0)

// ─── toYamlStr — empty states ─────────────────────────────────────────────────

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

// ─── toYamlStr — link resolution ─────────────────────────────────────────────

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

// ─── toYamlStr — buildParams default omission ────────────────────────────────

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

// ─── toYamlStr — unknown command fallback ────────────────────────────────────

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

// ─── toYamlStr — paths block ──────────────────────────────────────────────────

describe("toYamlStr — paths block", () => {
  test("path variable with value appears in paths block", () => {
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

// ─── toYamlStr — blank step filtering ────────────────────────────────────────

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

// ─── loadYamlFromText — blank / placeholder steps ────────────────────────────

describe("blank placeholder steps", () => {
  test("allows steps with command: '' in YAML object form", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
steps:
  - id: step1
    command: ''
    params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const step = result.steps[0] as {
      command: string
      id: string
    }
    expect(step.command).toBe("")
    expect(step.id).toBe("step1")
  })

  test("allows blank steps mixed with real steps", () => {
    const yaml = `
steps:
  - id: step1
    command: ''
    params: {}
  - id: step2
    command: makeDirectory
    params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(2)
    const [blank, real] = result.steps as Array<{
      command: string
      id: string
    }>
    expect(blank.command).toBe("")
    expect(real.command).toBe("makeDirectory")
  })

  test("preserves alias and isCollapsed on blank steps", () => {
    const yaml = `
steps:
  - id: step3
    command: ''
    alias: my placeholder
    isCollapsed: true
    params: {}
`
    const result = load(yaml)
    const step = result.steps[0] as {
      alias: string
      isCollapsed: boolean
    }
    expect(step.alias).toBe("my placeholder")
    expect(step.isCollapsed).toBe(true)
  })
})

// ─── loadYamlFromText — steps with commands ───────────────────────────────────

describe("steps with commands", () => {
  test("loads a step with known command and params", () => {
    const yaml = `
steps:
  - id: step1
    command: makeDirectory
    params:
      path: /tmp/output
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const step = result.steps[0] as {
      command: string
      params: Record<string, unknown>
    }
    expect(step.command).toBe("makeDirectory")
    expect(step.params.path).toBe("/tmp/output")
  })

  test("throws for a step with an unknown command", () => {
    const yaml = `
steps:
  - command: nonExistentCommand
    params: {}
`
    expect(() => load(yaml)).toThrow("Unknown command")
  })

  test("restores path-variable links from @-prefixed values", () => {
    const paths: PathVariable[] = [
      {
        id: "basePath",
        label: "basePath",
        value: "/media",
      },
    ]
    const yaml = `
steps:
  - command: makeDirectory
    params:
      path: '@basePath'
`
    const result = loadYamlFromText(
      yaml,
      FAKE_COMMANDS,
      paths,
      0,
    )
    const step = result.steps[0] as {
      links: Record<string, unknown>
    }
    expect(step.links.path).toBe("basePath")
  })

  test("restores step-output links from linkedTo object", () => {
    const yaml = `
steps:
  - command: makeDirectory
    params:
      path:
        linkedTo: step1
        output: folder
`
    const result = load(yaml)
    const step = result.steps[0] as {
      links: Record<string, unknown>
    }
    expect(step.links.path).toEqual({
      linkedTo: "step1",
      output: "folder",
    })
  })
})

// ─── loadYamlFromText — path restoration ─────────────────────────────────────

describe("path restoration", () => {
  test("restores paths from canonical YAML format", () => {
    const yaml = `
paths:
  myPath:
    label: My Path
    value: /home/user/media
steps: []
`
    const result = load(yaml)
    expect(result.paths).toContainEqual({
      id: "myPath",
      label: "My Path",
      value: "/home/user/media",
    })
  })

  test("seeds basePath when loading legacy array format", () => {
    const yaml = `
- command: makeDirectory
  params: {}
`
    const result = load(yaml)
    expect(result.paths[0].id).toBe("basePath")
  })
})

// ─── loadYamlFromText — groups ────────────────────────────────────────────────

describe("groups", () => {
  test("loads a serial group with inner steps", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    label: My Group
    isParallel: false
    steps:
      - command: makeDirectory
        params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const group = result.steps[0] as {
      kind: string
      steps: unknown[]
    }
    expect(group.kind).toBe("group")
    expect(group.steps).toHaveLength(1)
  })

  test("loads a group containing a blank step", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    isParallel: false
    steps:
      - id: step1
        command: ''
        params: {}
`
    const result = load(yaml)
    const group = result.steps[0] as {
      steps: Array<{ command: string }>
    }
    expect(group.steps[0].command).toBe("")
  })

  test("throws when group has no steps", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    isParallel: false
    steps: []
`
    expect(() => load(yaml)).toThrow("non-empty")
  })
})
